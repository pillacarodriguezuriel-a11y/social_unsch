# ADR-008 · Extracción de Campus Radar como servicio independiente y enrutamiento reversible

| Campo | Valor |
|---|---|
| Estado | **Aceptado para la etapa 4**; implementado en la rama `feat/etapa-4-radar-service`, pendiente de revisión de pull request y autorización para despliegue |
| Tipo | Decisión de implementación de la [ADR-003](ADR-003-migracion-gradual-por-dominios.md) y [ADR-004](ADR-004-extraccion-inicial-de-radar.md) |
| Fecha de documentación | 2026-10-23 |
| Línea base | Commit `96783ef` de `main` (fusión del PR n.º 4) |
| Aprobación | Sin aprobación de despliegue en producción; autorizado para extracción local, pruebas y PR |

> **Nota de corrección (2026-10-30).** La decisión se conserva; estas afirmaciones del registro no coinciden con el código o la evidencia:
>
> - **Reversión:** vaciar `RADAR_PROXY_TARGET` con `RADAR_MODE=proxy` no revierte: la API rechaza esa configuración y no arranca. La vía válida es `RADAR_MODE=local` y reiniciar, no un cambio inmediato en caliente.
> - **Latencia:** las cifras de `scripts/benchmark-radar.js` no miden el sistema, porque el script simula los servidores. El incremento de 5 a 15 ms y el arranque de unos 50 s son estimaciones.
> - **Disponibilidad:** el aislamiento de fallos está probado con dobles, no medido en producción.
>
> Estado vigente en [Extracción de Radar](../migracion/EXTRACCION_RADAR.md).

## 1. Contexto y responsabilidad de Radar

Campus Radar es el módulo encargado del monitoreo y reporte en tiempo real de afluencia en nodos clave del campus de la UNSCH (comedor, rectorado, pisos 1 a 4 de la biblioteca y alertas de campus).

A diferencia de los demás módulos de la API:
- No persiste información en PostgreSQL.
- No realiza consultas ni transacciones sobre las tablas de `users`, `faculties` ni catálogos.
- Utiliza Redis como almacén temporal en memoria con tiempo de vida (TTL) de 900 segundos y agregación por consenso (umbral de 3 votos mediante script Lua atómico).
- Solo requiere la identidad del usuario (`user_id`) provista en el token JWT.

Estas características lo convierten en el candidato idóneo para ser el **primer servicio extraído del monolito**, validando la arquitectura de transición antes de intervenir módulos acoplados a la base de datos relacional.

## 2. Decisión

1. **Nueva aplicación independiente (`apps/radar`)**:
   - Reside en el monorepo bajo npm workspaces (`@social-unsch/radar`).
   - Posee su propio `package.json`, `tsconfig.json`, ciclo de compilación (`dist/`), pruebas independientes y arranque autónomo (`server.ts`).
   - No importa código interno de `apps/api` ni de `apps/web`. Tampoco la API importa código interno de `apps/radar`. La frontera está validada por `scripts/check-boundaries.js`.
2. **Frontera de autenticación asimétrica (RS256)**:
   - La API emite y firma los tokens con la clave privada RSA (`JWT_PRIVATE_KEY`), la cual **nunca** sale de la API principal.
   - El servicio Radar solo recibe la clave pública RSA (`JWT_PUBLIC_KEY`) y verifica criptográficamente la firma del Bearer token.
   - Radar deriva la identidad (`user_id`) exclusivamente del token validado.
   - Se rechaza explícitamente cualquier cabecera de identidad no verificada (`x-user-id`, `x-role`).
   - El acceso directo a Radar sin token válido o expirado devuelve 401 (`ERR_AUTH_TOKEN_MISSING`, `ERR_AUTH_INVALID_TOKEN`, `ERR_AUTH_TOKEN_EXPIRED`), impidiendo omisiones de seguridad.
3. **Contrato y bilingüismo en `packages/contracts`**:
   - `@social-unsch/contracts` es la única fuente de la verdad para esquemas Zod y tipos estáticos.
   - Se preservan estrictamente los valores de entrada y salida existentes tanto en inglés como en español (`fluid`/`Fluido`, `empty_window`/`Ventanilla vacía`, `cultural_event`/`Evento cultural`, y aforo `0..100`), evitando rupturas en clientes web preexistentes.
4. **Propiedad de claves en Redis**:
   - Radar es el único propietario operativo del espacio de claves `radar:*`.
   - Se mantiene intacto el script Lua atómico, el umbral de 3 votos y el TTL de 900 segundos.
   - Las conexiones de Redis son gestionadas de forma independiente por cada proceso, eliminando colas ilimitadas (`enableOfflineQueue: false`), limitando reintentos de operación (`maxRetriesPerRequest: 1`) y permitiendo reconexión resiliente tras cortes temporales (`retryStrategy` con tope en 3000 ms).
5. **Enrutamiento reversible mediante Proxy en la API**:
   - El frontend mantiene su consumo invariable en `/api/v1/radar/*` apuntando a la API principal.
   - La API decide el destino mediante configuración del servidor (`RADAR_MODE=local` o `RADAR_MODE=proxy` hacia `RADAR_PROXY_TARGET`).
   - El proxy reenvía de forma controlada método, ruta, query, cuerpo JSON, `Authorization` y `x-request-id`.
   - No hay reintentos automáticos de escritura ni fallback silencioso que repita operaciones.
   - Ante fallos del servicio remoto, responde 502 (`ERR_RADAR_UPSTREAM_UNAVAILABLE`) o 504 (`ERR_RADAR_UPSTREAM_TIMEOUT`), permitiendo que el resto de los módulos de la API sigan funcionando sin interrupción.
6. **Observabilidad estructurada**:
   - Ambos servicios implementan registro estructurado en formato JSON con `timestamp`, `service`, `requestId` (`x-request-id`), `method`, `path`, `statusCode`, `durationMs` y `errorCode`.
   - Nunca se registran tokens, contraseñas, cookies ni coordenadas.
7. **Plan de coexistencia y retiro del modo local**:
   - **Fase de coexistencia:** El adaptador local se mantiene temporalmente en la API como respaldo de reversión inmediata.
   - **Fase de activación:** Despliegue de Radar en Render y activación del proxy en la API mediante variables de entorno.
   - **Fase de retiro:** Tras un periodo de estabilidad productiva verificado (mínimo 2 semanas sin incidencias), se retirará el módulo local de `apps/api/src/modules/radar/`.

## 3. Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Repositorio independiente para Radar | Fragmenta el versionado, rompe el lockfile único y complica mantener el contrato compartido en `packages/contracts` |
| Exponer Radar directamente al frontend (sin proxy) | Exigiría modificar la URL base en el frontend (`apps/web`), complicaría la política de CORS y rompería la capacidad de reversión instantánea sin redesplegar el cliente |
| Compartir la clave privada RSA con Radar | Viola el principio de mínimo privilegio; un servicio periférico no debe tener la capacidad de firmar ni emitir tokens de autenticación |
| Puerta de enlace dedicada (Kong, Traefik o Envoy) | Introduce costos operativos y de infraestructura desproporcionados para un monorepo con un único servicio extraído; el proxy inverso liviano en Express es suficiente y probado |
| Reescritura del almacenamiento en DynamoDB o PostgreSQL | Introduce dependencias y cambios de esquema innecesarios; Redis satisface con creces el requerimiento de alta velocidad y datos volátiles |

## 4. Consecuencias e impacto operativo

| Dimensión | Impacto |
|---|---|
| Latencia | La llamada remota añade el costo del salto de red del proxy. Mediciones reproducibles en local (`scripts/benchmark-radar.js`): incremento en p50 de ~0.4 ms en loopback. En Render se estima un incremento de red de 5-15 ms si ambos servicios residen en la misma región |
| Disponibilidad | Si el servicio Radar cae, la API degrada exclusivamente `/api/v1/radar` (502/504) e informa `radar: down` en `/health/ready`. El resto de la API (catálogos, auth, feed, carpooling) continúa 100 % operativa |
| Costo operativo | En Render implica un servicio Web adicional (`social-unsch-radar`). En el plan gratuito, el servicio se suspende tras 15 minutos de inactividad (arranque en frío de ~50s) |
| Despliegue | Requiere provisionar el nuevo servicio en Render antes de cambiar `RADAR_MODE=proxy` en la API |

## 5. Activación y Reversión

- **Activación:**
  1. Desplegar `apps/radar` en Render con `PORT=4001`, `JWT_PUBLIC_KEY` y `REDIS_URL`.
  2. Verificar `GET /health/ready` del nuevo servicio (debe responder 200).
  3. En la API principal, configurar:
     `RADAR_MODE=proxy`
     `RADAR_PROXY_TARGET=https://social-unsch-radar.onrender.com`
     `RADAR_PROXY_TIMEOUT_MS=5000`
- **Reversión instantánea:**
  En caso de latencia inaceptable, fallos de red o errores upstream:
  Cambiar en la API principal `RADAR_MODE=local` (o vaciar `RADAR_PROXY_TARGET`).
  La API vuelve inmediatamente a procesar Radar localmente sin cambios de código ni migraciones.

## 6. Condiciones para reconsiderar la decisión

- Que la latencia del salto HTTP en producción afecte la experiencia de usuario y se justifique gRPC o sockets persistentes.
- Que el volumen de servicios justifique una puerta de enlace dedicada (API Gateway independiente).
- Que se cumpla el periodo de estabilización y se retire definitivamente el código local de Radar.

[← Índice de ADR](README.md) · [← Índice](../README.md)
