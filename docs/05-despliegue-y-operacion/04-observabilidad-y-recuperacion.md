# Observabilidad y recuperación

**Observabilidad** es la capacidad de saber qué le ocurre a un sistema en ejecución a partir de lo que emite: registros, métricas y trazas. Este documento describe lo que el sistema ofrece hoy, que es poco, y lo que se propone. Los registros JSON y la correlación están en el PR n.º 5: **no llegan a producción hasta su fusión**.

## Qué se puede observar hoy

| Señal | Existe | Detalle | Evidencia |
|---|---|---|---|
| Registro de arranque | Sí | Una línea con el puerto y el modo | [server.ts](../../apps/api/src/server.ts) |
| Registro de conexión a Redis | Sí | Conexión, errores y aviso al agotar reintentos | [redis.ts](../../apps/api/src/config/redis.ts) |
| Registro de errores no controlados | Sí | `console.error` con el error completo | [error.middleware.ts](../../apps/api/src/middlewares/error.middleware.ts) |
| Registro de errores del pool | Sí | Errores inesperados de conexiones inactivas | [database.ts](../../apps/api/src/config/database.ts) |
| Registro de solicitudes | En el PR n.º 5 | JSON con `timestamp`, `service`, `requestId`, `method`, `path`, `statusCode`, `durationMs` y `errorCode`, en API y Radar | [logging.middleware.ts](../../apps/api/src/middlewares/logging.middleware.ts) |
| Identificador de solicitud | En el PR n.º 5 | `x-request-id` validado, generado si falta y propagado por el proxy | [logging.middleware.ts](../../apps/api/src/middlewares/logging.middleware.ts) |
| Rutas de salud | Sí, desde la etapa 3 | `GET /health/live` (proceso) y `GET /health/ready` (PostgreSQL crítico, radar no crítico; 503 solo si cae PostgreSQL) | [health.routes.ts](../../apps/api/src/health/health.routes.ts) |
| Validación de configuración al arrancar | Sí, desde la etapa 3 | Mensajes con nombres de variables, sin valores | [env.ts](../../apps/api/src/config/env.ts) |
| Cierre ordenado | Sí, desde la etapa 3 | `SIGTERM`/`SIGINT` cierran el servidor, Redis y PostgreSQL (límite de 10 s) | [server.ts](../../apps/api/src/server.ts), [bootstrap.ts](../../apps/api/src/bootstrap.ts) |
| Métricas | **No** | — | — |
| Trazas | **No** | — | — |
| Alertas | **No** | — | — |
| Auditoría de acciones de usuario | **No** | Solo existe una tabla de auditoría de moderación, sin uso | [004_moderation_and_carpooling.sql](../../apps/api/src/database/migrations/sql/004_moderation_and_carpooling.sql) |

En `main`, los registros son texto libre en la salida estándar. Dónde se conservan y durante cuánto tiempo depende de la plataforma de alojamiento; está pendiente de verificación.

Consecuencia: sin alertas, la forma de saber si el sistema falla es consultar la salud o usarlo. Un fallo de la base de datos se manifestó como errores 500 sin ninguna señal previa, según el informe de la etapa 1.

## Comprobaciones manuales disponibles

Sin acceso a los paneles, estas solicitudes de solo lectura permiten diagnosticar desde fuera. `<API>` representa la dirección pública de la API.

| Comprobación | Solicitud | Resultado si funciona | Qué indica un fallo |
|---|---|---|---|
| La API está en ejecución | `GET <API>/api/v1/radar/status` sin token | 401 con `ERR_AUTH_TOKEN_MISSING` | Sin respuesta: servicio caído o suspendido |
| La base de datos responde | `GET <API>/api/v1/catalogs` | 200 con facultades y escuelas | 500: base inaccesible o esquema sin aplicar |
| Catálogos cargados | La misma | Listas con contenido | Listas vacías: falta `npm run db:catalogs` |
| Autenticación operativa | `POST <API>/api/v1/auth/login` con un correo inexistente | 401 con `ERR_AUTH_INVALID_CREDENTIALS` | 500: base inaccesible |
| CORS | Solicitud `OPTIONS` con la cabecera `Origin` del frontend | 204 con el origen permitido | Sin cabecera de permiso: revisar `ALLOWED_ORIGINS` |
| Redis | `GET <API>/health/ready` | `radar: up` | `radar: down` con estado `degraded` |
| Radar remoto, tras activarlo | `GET <RADAR>/health/ready` | 200 con `redis: up` | 503: Redis inaccesible |
| Disponibilidad | `GET <API>/health/ready` | 200 `ready` | 503: PostgreSQL inaccesible |

Con acceso a las cadenas de conexión, el script [diagnostico-conexiones.js](../../apps/api/scripts/diagnostico-conexiones.js) ejecuta `SELECT 1` y `PING` sin modificar datos ni mostrar credenciales.

La primera solicitud tras un periodo sin uso puede tardar decenas de segundos; no debe interpretarse como caída.

## Modos de fallo conocidos

| Fallo | Síntoma para el usuario | Señal disponible | Recuperación |
|---|---|---|---|
| API suspendida por inactividad | La primera acción tarda mucho | Ninguna | Automática al recibir tráfico |
| Base de datos pausada o inaccesible | No se puede iniciar sesión; errores genéricos | Errores 500 en el registro de la API | Reactivar la base en el panel del proveedor; la API se recupera sin redespliegue, según el diseño del pool |
| Redis inaccesible | El radar no carga; lo demás funciona | `radar: down` en `/health/ready` y errores de conexión | Restaurar el recurso o corregir `REDIS_URL`. En `main` el cliente deja de reintentar tras 5 fallos y puede requerir reinicio; el PR n.º 5 reconecta sin límite |
| Servicio Radar caído, en modo proxy | Radar responde 502 o 504; lo demás funciona | `radar: down` en la API | Corregir el servicio o [revertir](../migracion/EXTRACCION_RADAR.md#estrategia-de-rollback) |
| Esquema por detrás del código | Errores 500 en rutas concretas | Error de SQL en el registro | Aplicar las migraciones pendientes |
| Claves JWT cambiadas | Todos los usuarios pierden la sesión | Respuestas 401 | Volver a iniciar sesión |
| Origen CORS mal configurado | El frontend no puede llamar a la API | Error en la consola del navegador | Corregir `ALLOWED_ORIGINS` y redesplegar |

## Pérdida de datos: qué se perdería

| Almacén | Si se pierde | Impacto |
|---|---|---|
| Redis | Votos y estados del radar | Bajo: se reconstruye en minutos con nuevos reportes |
| PostgreSQL | Cuentas, publicaciones, perfiles, rutas, solicitudes | Alto: irrecuperable sin respaldo |
| `localStorage` del usuario | Sesión y datos de las pantallas simuladas | La sesión se recupera iniciando sesión; los datos simulados se pierden |

No hay en el repositorio ningún procedimiento ni automatización de respaldo de PostgreSQL. Si el proveedor ofrece copias automáticas, su existencia y retención están pendientes de verificación.

## Propuesta

> **Estado: Propuesto.** Nada de esta sección está implementado.

### Mínimo antes de extraer el primer servicio (etapa 3)

Tras la etapa 3: rutas de vida y disponibilidad, respuesta 503 en la disponibilidad y validación de configuración están **implementadas**. Registro de solicitudes e identificador de solicitud están en el PR n.º 5, sin fusionar.

| Elemento | Descripción |
|---|---|
| Ruta de vida | Responde 200 si el proceso atiende; no consulta dependencias |
| Ruta de disponibilidad | Comprueba PostgreSQL y Redis y responde 503 si alguno falla, indicando cuál |
| Registro de solicitudes | Una línea estructurada por solicitud: método, ruta, estado, duración e identificador |
| Identificador de solicitud | Generado en la entrada y propagado a cada servicio |
| Validación de configuración al arrancar | El proceso no arranca si falta una variable obligatoria |
| Respuesta 503 para dependencias caídas | Distinguir «no disponible» de «error interno» |

### Para la consolidación (etapa 8)

| Elemento | Descripción |
|---|---|
| Métricas por ruta | Tasa de solicitudes, de errores y duración |
| Alertas | Sobre la ruta de disponibilidad y la tasa de errores |
| Respaldo programado | Copia periódica de PostgreSQL fuera del proveedor, con una restauración de prueba |
| Objetivos de servicio | Definir y medir disponibilidad y latencia; hoy solo hay objetivos sin validar en [Escenarios de calidad](../01-analisis-del-sistema/08-escenarios-de-calidad.md) |
| Reconexión a Redis | Implementada en el PR n.º 5 |
| Cierre ordenado | Implementado en la etapa 3 |

### Objetivos de recuperación

Dos medidas habituales: el **tiempo objetivo de recuperación**, cuánto puede tardar el servicio en volver, y el **punto objetivo de recuperación**, cuántos datos recientes es aceptable perder.

| Medida | Valor actual | Propuesta pendiente de validación |
|---|---|---|
| Tiempo de recuperación ante base pausada | Sin medir | Menos de 30 minutos desde que el operador lo detecta |
| Pérdida aceptable en PostgreSQL | Sin definir; sin respaldos verificados | Como máximo 24 horas |
| Pérdida aceptable en Redis | Total, por diseño | Sin cambio |

Estos valores son puntos de partida para discutir, no compromisos ni mediciones.

[← Índice](../README.md)
