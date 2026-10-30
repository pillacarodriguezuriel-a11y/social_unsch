# Extracción de Radar

Documento vivo del estado de la extracción, verificado el 2026-10-30 sobre `f480728`. El registro histórico de la implementación es [ETAPA_04](ETAPA_04_EXTRACCION_RADAR.md); la decisión, [ADR-008](../06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md). Si difieren, vale este documento y, por encima de él, el código.

## ¿Por qué Radar?

| Motivo | Evidencia |
|---|---|
| No usa PostgreSQL | Ninguna importación de `pg`; regla `radar-sin-pg` |
| No depende de otros módulos | Regla `modulos-aislados` |
| Su identidad basta con el token | Solo usa `user_id` |
| Sus datos son efímeros y reconstruibles | Vigencia de 900 s |
| Su fallo no debe afectar al resto | Readiness lo trata como dependencia no crítica |

Es el dominio con menor costo de separación. Sirve para validar el mecanismo antes de tocar dominios con datos relacionales.

## Estado actual

| Aspecto | Estado | Evidencia |
|---|---|---|
| Código de `apps/radar` | IMPLEMENTADO | 5 commits en `feat/etapa-4-radar-service` |
| Fusión a `main` | PENDIENTE | PR n.º 5 abierto; `main` sigue en `96783ef` |
| CI, job `verify` | Correcto | Ejecución `39985651148` |
| CI, job `test-real` | **Fallido** | Misma ejecución; causa en [Pruebas requeridas](#pruebas-requeridas) |
| Pruebas locales con dobles | Correctas | 59 de 59 en Radar; 448 de 448 en la API (2026-10-30) |
| Despliegue en Render | NO IMPLEMENTADO | `social-unsch-radar.onrender.com/health/live` respondió 404 el 2026-10-30 |
| Modo en producción | Local | `radar: up` con el servicio remoto inexistente. Valor de la variable: PENDIENTE DE VALIDACIÓN |

**Conclusión:** Radar tiene código de servicio independiente, pero **aún no es un servicio en operación**.

## Dependencias

| Dependencia | Uso |
|---|---|
| Redis | Único almacén |
| `@social-unsch/contracts` | Nodos, estados, umbral, vigencia y códigos de error |
| `JWT_PUBLIC_KEY` | Verificación de tokens |
| API principal | Solo como emisora de tokens y entrada del tráfico; sin llamadas en ejecución |

## Redis

| Clave | Tipo | Contenido | Vigencia |
|---|---|---|---|
| `radar:<nodo>:reports:<estado>` | Conjunto | Identificadores de quienes votaron | 900 s, renovados con cada voto |
| `radar:comedor:status`, `radar:rectorado:status`, `radar:campus_alert:status` | Hash | Estado, `report_count`, `last_updated` | 900 s |
| `radar:biblioteca:floor:<n>:occupancy` | Hash | Aforo, `report_count`, `last_updated` | 900 s |

El script Lua registra el voto, cuenta y publica con 3 votos iguales. Es texto idéntico en ambas implementaciones, pero **los argumentos difieren**: la API guarda `last_updated` en segundos Unix y Radar en ISO 8601. Hoy no tiene efecto porque `getStatus` no lee ese campo.

Cliente en ambos procesos: `enableOfflineQueue: false`, `maxRetriesPerRequest: 1` y reconexión con tope de 3 s.

## Base de datos

Radar no usa PostgreSQL y no se requiere ninguna migración para esta etapa.

## API

| Método y ruta | Autenticación | Respuesta |
|---|---|---|
| `GET /api/v1/radar/status` | Bearer | 200 con siete nodos |
| `POST /api/v1/radar/report` | Bearer | 200 con `updated` |
| `GET /health/live` | No | 200 |
| `GET /health/ready` | No | 200 o 503 según Redis |

El servicio monta además `/status` y `/report` en la raíz. Esas rutas no están en el contrato ni las usa el proxy (DT-49).

## Contratos

La fuente única es [radar.ts](../../packages/contracts/src/radar.ts).

| Elemento | Valor |
|---|---|
| Nodos | `comedor`, `rectorado`, `biblioteca_floor_1` a `4`, `campus_alert` |
| Umbral | 3 votos |
| Vigencia | 900 s |
| Sin estado vigente | `indefinido` |
| Errores | 400, 401, 500 y, solo en proxy, 502 y 504 |

Las constantes se usan en ejecución; los esquemas Zod, solo en pruebas. `zod` figura como dependencia de `apps/radar`, pero su código no lo importa.

## Proceso de extracción

```mermaid
flowchart LR
    A["Preparar CI y límites"] --> B["Crear apps/radar"]
    B --> C["Reforzar Redis y registros"]
    C --> D["Probar con dobles"]
    D --> E["Corregir test-real"]
    E --> F["Fusionar"]
    F --> G["Desplegar Radar"]
    G --> H["Medir"]
    H --> I["Activar proxy"]
    I --> J["Observar 2 semanas"]
    J --> K["Retirar Radar local"]

    classDef hecho stroke:#2e7d32,stroke-width:3px
    classDef pend stroke-dasharray: 5 5
    class A,B,C,D hecho
    class E,F,G,H,I,J,K pend
```

Trazo verde: hecho. Trazo discontinuo: pendiente.

## Arquitectura antes

Estado de `main` y de producción.

```mermaid
flowchart LR
    W["Web"] --> A["API con módulo radar"] --> R[("Redis")]
    A --> P[("PostgreSQL")]
```

## Arquitectura durante

Estado del código en el PR, tras desplegar y activar.

```mermaid
flowchart LR
    W["Web"] --> A["API"]
    A -- "proxy" --> S["Servicio Radar"]
    A -. "reversión" .-> L["Radar local"]
    S --> R[("Redis")]
    L -.-> R
    A --> P[("PostgreSQL")]
```

## Arquitectura después

**PROPUESTO.**

```mermaid
flowchart LR
    W["Web"] --> A["API"]
    A -- "proxy" --> S["Servicio Radar"]
    S --> R[("Redis")]
    A --> P[("PostgreSQL")]
```

## Activación

Requiere autorización. Orden:

1. Fusionar con la CI en verde.
2. Crear el servicio en Render con `NODE_ENV`, `REDIS_URL`, `JWT_PUBLIC_KEY` y `ALLOWED_ORIGINS`.
3. Comprobar `/health/ready` del servicio.
4. Definir en la API `RADAR_MODE=proxy` y `RADAR_PROXY_TARGET`, y reiniciarla.
5. Comprobar `/health/ready` de la API y `/api/v1/radar/status` con un token válido.

Ajustes de comandos de compilación en [ETAPA_04 §12](ETAPA_04_EXTRACCION_RADAR.md#12-procedimiento-de-despliegue-en-render-preparación-para-producción).

## Estrategia de rollback

1. En la API, definir `RADAR_MODE=local`. Dejar `REDIS_URL` definida.
2. Reiniciar la API: la configuración solo se lee al arrancar.
3. Comprobar `/health/ready` con `radar: up`.
4. Probar `GET /api/v1/radar/status` con un token válido.

| Aspecto | Comportamiento |
|---|---|
| Datos | Se conservan si ambos procesos usan el mismo Redis |
| Código | Sin cambios |
| Interrupción | La del reinicio de la API. Tiempo: PENDIENTE DE MEDICIÓN |
| Ensayo | **Sin realizar en producción** |

No eliminar `RADAR_PROXY_TARGET` ni dejarlo vacío con `RADAR_MODE=proxy`: la API rechaza esa configuración y no arranca. Corrige lo que indicaba ADR-008 ([prueba](../../apps/api/tests/unit/env.test.ts)).

## Riesgos

| Riesgo | Efecto | Mitigación | Estado |
|---|---|---|---|
| Arranque en frío de Radar mayor que el límite del proxy | Con suspensión por inactividad, las primeras solicitudes reciben 504: el límite máximo es 30 s y la API tardó 32,6 s en despertar | Instancia sin suspensión o latido programado; medir | Abierto |
| Implementaciones divergentes | Reversión con comportamiento distinto | Congelar cambios; retirar la copia local a tiempo | Abierto; ya hay una diferencia en `last_updated` |
| Dos entradas a Radar | El servicio queda expuesto en internet además de por la API | Exige token; valorar una restricción adicional | Abierto |
| CORS permisivo | Sin `ALLOWED_ORIGINS` en producción usa orígenes por defecto con `localhost`, solo con aviso | Definir la variable; endurecer `env.ts` | Abierto |
| Pruebas reales sin ejecutarse en CI | Fusionar sin la red de seguridad prevista | Corregir `test-real` | **Bloqueante** |
| Sin pruebas de `apps/radar` con Redis real | El script Lua solo se prueba de verdad desde la API | Añadir suite real | Abierto |
| Costo y operación | Un servicio más | Medir antes de seguir | Abierto |

## Pruebas requeridas

| Prueba | Estado | Evidencia |
|---|---|---|
| Unitarias, contrato y salud | Correctas con dobles | [apps/radar/tests](../../apps/radar/tests/unit/radar.service.test.ts) |
| Autenticación directa | Correcta con dobles | [radar.direct-auth.test.ts](../../apps/radar/tests/integration/radar.direct-auth.test.ts) |
| Proxy contra Radar por HTTP real | Correcta; Redis simulado | [proxy.e2e.test.ts](../../apps/radar/tests/integration/proxy.e2e.test.ts) |
| Paridad | Limitada: comprueba `apps/radar` contra valores esperados, **sin ejecutar** la implementación de la API | [radar.parity.test.ts](../../apps/radar/tests/parity/radar.parity.test.ts) |
| API contra PostgreSQL y Redis reales | **Fallida en CI** | Ver abajo |
| `apps/radar` contra Redis real | NO IMPLEMENTADO | — |
| Reversión en plataforma real | NO IMPLEMENTADO | — |

**Fallo de `test-real`.** El log exige autenticación y no se pudo leer; las anotaciones públicas solo indican `exit code 1`. Hipótesis por análisis del código, PENDIENTE DE VALIDACIÓN: el flujo declara servicios en los puertos 55432 y 56379, y el arnés [test-environment.ts](../../apps/api/tests/real/helpers/test-environment.ts) lanza sus propios contenedores en esos mismos puertos, lo que provocaría un conflicto. El arnés además ignora las variables `DATABASE_URL` y `REDIS_URL` del flujo. Primera acción: leer el log.

## Métricas

| Métrica | Meta propuesta | Resultado |
|---|---|---|
| Latencia p95 por proxy frente a local | No peor en más de un 20 % | PENDIENTE DE MEDICIÓN |
| Tasa de 5xx en `/api/v1/radar/*` | No superior a la previa | PENDIENTE DE MEDICIÓN |
| Arranque en frío de Radar | Menor que `RADAR_PROXY_TIMEOUT_MS` | PENDIENTE DE MEDICIÓN |
| Tiempo de reversión | Por definir | PENDIENTE DE MEDICIÓN |
| Aislamiento: Radar caído, resto de la API sin errores | 0 % de errores | Probado con dobles; PENDIENTE DE MEDICIÓN en producción |

> Las cifras de latencia de ETAPA_04 **no miden el sistema**. [benchmark-radar.js](../../scripts/benchmark-radar.js) levanta servidores HTTP escritos a mano con un almacén en memoria: no ejecuta `apps/api`, `apps/radar` ni Redis. Ver [Métricas](../07-evaluacion-y-evolucion/06-metricas.md).

Ver también: [Estrategia de migración](README.md) · [C2 de transición](../04-modelo-c4/05-contenedores-de-transicion.md) · [Nivel de código de Radar](../04-modelo-c4/04-codigo-y-secuencias.md) · [Pendientes](../07-evaluacion-y-evolucion/08-pendientes.md)

[← Índice](../README.md)
