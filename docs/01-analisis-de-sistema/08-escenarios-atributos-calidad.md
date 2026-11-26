# Escenarios de calidad

> Radar conserva los criterios de 50 usuarios/p95 <500 ms, sobrecarga <=20%, 100 reportes válidos por minuto sin errores ni pérdidas y aislamiento de otros flujos. La prueba comparable exige calentamiento, tres repeticiones alternadas y resultados por repetición. Método y veredictos: [Operación de Radar](../migracion/ETAPA_05_OPERACION_RADAR.md). Un SLO operativo propuesto no modifica estos criterios.

Cada escenario concreta un [atributo de calidad](04-atributos-de-calidad.md) en una situación comprobable. Sigue la estructura fuente, estímulo, entorno, artefacto («elemento afectado»), respuesta y métrica («medida»). Los resultados están en [Métricas](../07-evaluacion-y-evolucion/06-metricas.md). Las medidas numéricas marcadas como **objetivo** son propuestas pendientes de validación: no hay mediciones de rendimiento ni de disponibilidad en el repositorio.

En la columna de estado, «Verificado» significa que existe una prueba automatizada que cubre la respuesta; la fecha y procedencia de sus ejecuciones están en el [informe de documentación](../INFORME_DOCUMENTACION.md).

## EC-01 Seguridad: registro con rol privilegiado

| Elemento | Descripción |
|---|---|
| Fuente | Visitante sin sesión |
| Estímulo | Envía un registro con `role: "administrator"` |
| Entorno | Operación normal |
| Elemento afectado | Módulo de autenticación |
| Respuesta esperada | Rechazo sin crear la cuenta |
| Medida | 100 % de los intentos rechazados; ninguna fila nueva en `users` |
| Verificación | [auth.real.test.ts](../../apps/api/tests/real/auth.real.test.ts), escenario 2; [auth.validators.test.ts](../../apps/api/tests/unit/auth.validators.test.ts) |
| Estado | Implementado y verificado con prueba automatizada |

## EC-02 Seguridad: acceso sin token válido

| Elemento | Descripción |
|---|---|
| Fuente | Cliente HTTP sin token, con token alterado o expirado |
| Estímulo | Solicita una ruta protegida |
| Entorno | Operación normal |
| Elemento afectado | Middleware `requireAuth` |
| Respuesta esperada | Respuesta 401 con un código de error específico; la lógica del módulo no se ejecuta |
| Medida | 100 % de las solicitudes rechazadas |
| Verificación | [auth.real.test.ts](../../apps/api/tests/real/auth.real.test.ts), escenario 5; pruebas de rutas en [tests/integration](../../apps/api/tests/integration) |
| Estado | Implementado y verificado con prueba automatizada |

## EC-03 Integridad: dos solicitudes simultáneas del mismo asiento

| Elemento | Descripción |
|---|---|
| Fuente | Un pasajero que envía dos solicitudes a la vez para la misma ruta |
| Estímulo | Dos `POST /carpooling/:route_id/request` concurrentes |
| Entorno | Base de datos con el índice único de solicitudes activas creado |
| Elemento afectado | Módulo de carpooling y PostgreSQL |
| Respuesta esperada | Una solicitud se acepta; la otra recibe un error de negocio 400 |
| Medida | Exactamente una fila activa por ruta y pasajero |
| Verificación | [carpooling.real.test.ts](../../apps/api/tests/real/carpooling.real.test.ts), escenario 2 |
| Estado | Implementado y verificado con prueba automatizada. Depende de que el índice exista; ver [Errores y consistencia](../03-diseño-de-software/06-errores-y-consistencia.md) |

## EC-04 Integridad: competencia por el último asiento

| Elemento | Descripción |
|---|---|
| Fuente | Conductor que confirma a dos pasajeros a la vez |
| Estímulo | Dos confirmaciones concurrentes con un solo asiento disponible |
| Entorno | Operación normal |
| Elemento afectado | `confirmBookingTransaction` |
| Respuesta esperada | Una confirmación tiene éxito; la otra recibe «sin asientos» |
| Medida | `available_seats` nunca es negativo |
| Verificación | [carpooling.real.test.ts](../../apps/api/tests/real/carpooling.real.test.ts), escenario 6 |
| Estado | Implementado y verificado con prueba automatizada |

## EC-05 Integridad: voto duplicado en el radar

| Elemento | Descripción |
|---|---|
| Fuente | Usuario autenticado |
| Estímulo | Reporta dos veces el mismo estado del mismo punto en menos de 15 minutos |
| Entorno | Redis disponible |
| Elemento afectado | Script de votación del radar |
| Respuesta esperada | El segundo voto no se cuenta |
| Medida | El contador de votos aumenta en 1, no en 2 |
| Verificación | [radar.real.test.ts](../../apps/api/tests/real/radar.real.test.ts), escenario 1 |
| Estado | Implementado y verificado con prueba automatizada |

## EC-06 Disponibilidad: Redis no responde

| Elemento | Descripción |
|---|---|
| Fuente | Fallo del servicio Redis |
| Estímulo | La conexión a Redis se pierde |
| Entorno | API en ejecución |
| Elemento afectado | Módulo de radar y resto de la API |
| Respuesta esperada | El radar responde con error controlado; autenticación, feed, matchmaking y carpooling siguen funcionando |
| Medida | **Objetivo pendiente de validación:** 0 % de errores en rutas que no usan Redis |
| Verificación | [radar.e2e.test.js](../../tests/e2e/radar.e2e.test.js), escenarios 10 y 11: Redis detenido y pausado |
| Estado | Implementado y verificado con infraestructura real en local y CI ([cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md)). El ensayo reveló dos defectos, ya corregidos: solicitudes pendientes sin límite con Redis pausado y respuestas 200 «indefinido» con Redis caído |

## EC-07 Disponibilidad: PostgreSQL no responde

| Elemento | Descripción |
|---|---|
| Fuente | Base de datos pausada o inaccesible |
| Estímulo | Un usuario intenta iniciar sesión |
| Entorno | API en ejecución |
| Elemento afectado | Toda ruta que use PostgreSQL |
| Respuesta esperada | Error controlado que distinga «servicio no disponible» de un fallo interno, y una ruta de salud que lo refleje |
| Medida | **Objetivo pendiente de validación:** respuesta 503 en menos de 3 segundos |
| Verificación | Prueba propuesta: detener PostgreSQL y consultar la ruta de salud |
| Estado | Parcial. `/health/ready` responde 503 si cae PostgreSQL. Las rutas de negocio siguen devolviendo un 500 genérico |

## EC-08 Modificabilidad: extraer el radar

| Elemento | Descripción |
|---|---|
| Fuente | Desarrollador |
| Estímulo | Mover el módulo de radar a un proceso independiente |
| Entorno | Tiempo de desarrollo |
| Elemento afectado | Módulo de radar, configuración y entrada de la API |
| Respuesta esperada | El cambio no modifica el código de los demás módulos ni el contrato que consume el frontend |
| Medida | **Objetivo pendiente de validación:** cero archivos modificados en otros módulos; las pruebas existentes del radar pasan sin cambios en sus aserciones |
| Verificación | Revisión del cambio y ejecución de [radar.real.test.ts](../../apps/api/tests/real/radar.real.test.ts) |
| Estado | Implementado en código: `apps/radar` no modificó otros módulos ni el contrato. No validado en producción; las pruebas reales fallan en CI |

## EC-09 Rendimiento: consulta del radar

| Elemento | Descripción |
|---|---|
| Fuente | Estudiante |
| Estímulo | Consulta el estado del campus |
| Entorno | Servicio activo, no en arranque en frío |
| Elemento afectado | `GET /radar/status` |
| Respuesta esperada | Estado consolidado de los siete puntos en una sola respuesta |
| Medida | **Objetivo pendiente de validación:** percentil 95 inferior a 500 ms con 50 usuarios simultáneos |
| Verificación | [benchmark-radar.js](../../scripts/benchmark-radar.js), escenario S1 |
| Estado | Medido en local, ver [cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md). Sin medición en la plataforma real |

## EC-10 Operabilidad: migración fallida

| Elemento | Descripción |
|---|---|
| Fuente | Operador |
| Estímulo | Ejecuta una migración con un error de SQL |
| Entorno | Base de datos con datos existentes |
| Elemento afectado | Migrador |
| Respuesta esperada | La migración se revierte por completo, no se registra como aplicada y el proceso termina con código distinto de cero |
| Medida | Cero cambios parciales; código de salida 1 |
| Verificación | [migrations.real.test.ts](../../apps/api/tests/real/migrations.real.test.ts), escenario 14 |
| Estado | Implementado y verificado con prueba automatizada |

## EC-11 Recuperación: reanudar el servicio tras una pausa de la base de datos

| Elemento | Descripción |
|---|---|
| Fuente | Operador |
| Estímulo | La base de datos de producción vuelve a estar disponible |
| Entorno | API desplegada |
| Elemento afectado | API y base de datos |
| Respuesta esperada | La API vuelve a atender sin redespliegue y existe un procedimiento escrito de comprobación |
| Medida | **Objetivo pendiente de validación:** servicio restablecido en menos de 30 minutos desde la reactivación |
| Verificación | Ejecutar [diagnostico-conexiones.js](../../apps/api/scripts/diagnostico-conexiones.js) y las comprobaciones de [Observabilidad y recuperación](../05-despliegue-y-operacion/04-observabilidad-y-recuperacion.md) |
| Estado | Parcial. Hay un script de diagnóstico; no hay registro del tiempo real de recuperación |

## EC-12 Resiliencia: el servicio Radar deja de responder

| Elemento | Descripción |
|---|---|
| Fuente | Fallo o suspensión del servicio Radar |
| Estímulo | Solicitud a `/api/v1/radar/status` con `RADAR_MODE=proxy` |
| Entorno | API en ejecución |
| Elemento afectado | Proxy de Radar y resto de la API |
| Respuesta esperada | 502 o 504 solo en Radar; `/health/ready` informa `degraded`; los demás módulos siguen atendiendo |
| Medida | 0 % de errores en rutas ajenas a Radar; respuesta dentro de `RADAR_PROXY_TIMEOUT_MS` |
| Verificación | [radar.proxy.test.ts](../../apps/api/tests/integration/radar.proxy.test.ts), [proxy.e2e.test.ts](../../apps/radar/tests/integration/proxy.e2e.test.ts) |
| Estado | Verificado con procesos reales en local y CI (E2E, escenarios 8 y 9). Sin medición en producción |

## EC-13 Seguridad: acceso directo al servicio Radar

| Elemento | Descripción |
|---|---|
| Fuente | Cliente que llama a Radar sin pasar por la API |
| Estímulo | Solicitud sin token, con token alterado o con `x-user-id` falsificado |
| Entorno | Servicio Radar expuesto |
| Elemento afectado | `createRadarAuthGuard` |
| Respuesta esperada | 401; la cabecera falsificada se ignora |
| Medida | 100 % de las solicitudes rechazadas |
| Verificación | [radar.direct-auth.test.ts](../../apps/radar/tests/integration/radar.direct-auth.test.ts) |
| Estado | Implementado y verificado con prueba automatizada |

## EC-14 Escalabilidad: aumento de reportes en el radar

| Elemento | Descripción |
|---|---|
| Fuente | Muchos estudiantes en horario de almuerzo |
| Estímulo | **Objetivo pendiente de validación:** 100 reportes por minuto |
| Entorno | Servicio Radar desplegado, una instancia |
| Elemento afectado | Servicio Radar y Redis |
| Respuesta esperada | Los votos se cuentan sin pérdida; la API no se degrada |
| Medida | **Objetivo pendiente de validación:** 0 % de errores y p95 inferior a 500 ms |
| Verificación | Prueba de carga por definir |
| Estado | Medido en local con una instancia, ver [cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md). Varias instancias: no probado |

## EC-15 Mantenibilidad: cambio del contrato de Radar

| Elemento | Descripción |
|---|---|
| Fuente | Desarrollador |
| Estímulo | Añade un estado o cambia una respuesta |
| Entorno | Tiempo de desarrollo |
| Elemento afectado | `packages/contracts`, API, Radar y web |
| Respuesta esperada | Las pruebas de contrato o los tipos fallan si una parte queda desalineada |
| Medida | Cambio detectado antes de fusionar |
| Verificación | `npm run verify` y pruebas de contrato |
| Estado | Implementado en `verify`; una divergencia de lógica entre las dos implementaciones podría no detectarse |

## EC-16 Resiliencia: el servicio Feed deja de responder

| Elemento | Descripción |
|---|---|
| Fuente | Fallo del proceso, de la red o del plan de alojamiento |
| Estímulo | `apps/feed` no responde con `FEED_MODE=proxy` activo |
| Entorno | Producción, modo proxy |
| Elemento afectado | `/api/v1/feed`; el resto de la API no debe degradarse |
| Respuesta esperada | 502 `ERR_FEED_UPSTREAM_UNAVAILABLE` o 504 `ERR_FEED_UPSTREAM_TIMEOUT`, un solo intento, sin respaldo automático al modo local. `feed: down` en `/health/ready` con estado `degraded`. Catálogos, autenticación, matchmaking y carpooling siguen en 200 |
| Medida | Ningún fallo atribuible a Feed en los demás flujos; reversión por `FEED_MODE=local` sin pérdida de publicaciones |
| Verificación | [feed.proxy.test.ts](../../apps/api/tests/integration/feed.proxy.test.ts) y [feed.e2e.test.js](../../tests/e2e/feed.e2e.test.js) |
| Estado | Probado en local y en CI. **No observado en producción:** el servicio no está desplegado |

## EC-17 Seguridad: acceso directo al servicio Feed

| Elemento | Descripción |
|---|---|
| Fuente | Cliente que alcanza `apps/feed` sin pasar por la API |
| Estímulo | Solicitud sin token, con token inválido, caducado, manipulado o firmado con otra clave; o con una cabecera `x-user-id` falsificada |
| Entorno | Producción, servicio desplegado |
| Elemento afectado | `apps/feed` |
| Respuesta esperada | 401 en todos los casos. El servicio deriva la identidad **solo** de la firma RS256 verificada con la clave pública, y nunca de una cabecera |
| Medida | 0 accesos concedidos sin un token válido |
| Verificación | [auth.middleware.test.ts](../../apps/feed/tests/unit/auth.middleware.test.ts), E2E de acceso directo y `ops:probe` con `PROBE_FEED` (un 200 sin token sería un fallo) |
| Estado | Probado en local y en CI. **No observado en producción:** el servicio no está desplegado |

## EC-18 Integridad: una escritura del Feed que agota el tiempo del proxy

| Elemento | Descripción |
|---|---|
| Fuente | Latencia o caída del servicio durante una escritura |
| Estímulo | `POST /api/v1/feed` supera `FEED_PROXY_TIMEOUT_MS` |
| Entorno | Producción, modo proxy |
| Elemento afectado | Tabla `feed_posts` |
| Respuesta esperada | 504 controlado. **No hay reintento automático ni respaldo entre procesos**, porque la operación no es idempotente: la publicación puede haberse creado. El cliente debe comprobar con `GET /api/v1/feed` antes de reenviar |
| Medida | 0 publicaciones duplicadas atribuibles a un reintento del sistema |
| Verificación | [feed.proxy.test.ts](../../apps/api/tests/integration/feed.proxy.test.ts): comprueba un solo intento ante tiempo agotado |
| Estado | Probado en local y en CI. **Riesgo residual aceptado y documentado:** resolver la idempotencia exigiría una clave de deduplicación que hoy no existe |

## EC-19 Modificabilidad: cambiar una regla del Feed sin que los dos modos divierjan

| Elemento | Descripción |
|---|---|
| Fuente | Desarrollador |
| Estímulo | Cambia un filtro, el orden, la paginación o un mensaje de error del Feed |
| Entorno | Tiempo de desarrollo |
| Elemento afectado | `packages/feed-domain`; de ahí, la API en modo local y `apps/feed` |
| Respuesta esperada | El cambio se aplica a los dos modos a la vez porque hay **una sola implementación**. Si alguien cambiara solo un modo, las pruebas de contrato en espejo fallarían |
| Medida | Imposible que el modo local y el proxy respondan distinto a la misma petición |
| Verificación | `npm run verify`: pruebas de `feed-domain`, contrato en [API](../../apps/api/tests/contract/feed.contract.test.ts) y en [servicio](../../apps/feed/tests/contract/feed.contract.test.ts), y paridad en E2E |
| Estado | **Implementado.** Es la diferencia con EC-15: Radar sí tiene dos implementaciones y conserva ese riesgo ([P-06](../07-evaluacion-y-evolucion/08-pendientes.md#p-06--dos-implementaciones-de-radar)) |

## EC-20 Disponibilidad: PostgreSQL cae con el Feed extraído

| Elemento | Descripción |
|---|---|
| Fuente | Pausa, agotamiento de conexiones o incidencia del proveedor |
| Estímulo | PostgreSQL deja de responder con `FEED_MODE=proxy` activo |
| Entorno | Producción, modo proxy |
| Elemento afectado | La API **y** `apps/feed`: comparten la base |
| Respuesta esperada | 503 en `/health/ready` de ambos procesos. **Revertir a `FEED_MODE=local` no resuelve nada**, porque la causa es compartida |
| Medida | El diagnóstico distingue caída de un proceso de caída de la base antes de intentar cualquier reversión |
| Verificación | E2E con PostgreSQL detenido; [guía de recuperación](../05-despliegue-y-operacion/04-observabilidad-y-recuperacion.md#modos-de-fallo-conocidos) |
| Estado | Probado en local. **Consecuencia directa de que Feed no tenga datos propios** ([P-28](../07-evaluacion-y-evolucion/08-pendientes.md#p-28--feed-no-tiene-independencia-de-datos)) |

[← Índice](../README.md)
