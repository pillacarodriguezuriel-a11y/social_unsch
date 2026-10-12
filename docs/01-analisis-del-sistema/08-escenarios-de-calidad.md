# Escenarios de calidad

Cada escenario concreta un [atributo de calidad](05-atributos-de-calidad.md) en una situación comprobable. Las medidas numéricas marcadas como **objetivo** son propuestas pendientes de validación: no hay mediciones de rendimiento ni de disponibilidad en el repositorio.

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
| Verificación | [auth.real.test.ts](../../tests/real/auth.real.test.ts), escenario 2; [auth.validators.test.ts](../../tests/unit/auth.validators.test.ts) |
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
| Verificación | [auth.real.test.ts](../../tests/real/auth.real.test.ts), escenario 5; pruebas de rutas en [tests/integration](../../tests/integration) |
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
| Verificación | [carpooling.real.test.ts](../../tests/real/carpooling.real.test.ts), escenario 2 |
| Estado | Implementado y verificado con prueba automatizada. Depende de que el índice exista; ver [Errores y consistencia](../03-diseno-de-software/06-errores-y-consistencia.md) |

## EC-04 Integridad: competencia por el último asiento

| Elemento | Descripción |
|---|---|
| Fuente | Conductor que confirma a dos pasajeros a la vez |
| Estímulo | Dos confirmaciones concurrentes con un solo asiento disponible |
| Entorno | Operación normal |
| Elemento afectado | `confirmBookingTransaction` |
| Respuesta esperada | Una confirmación tiene éxito; la otra recibe «sin asientos» |
| Medida | `available_seats` nunca es negativo |
| Verificación | [carpooling.real.test.ts](../../tests/real/carpooling.real.test.ts), escenario 6 |
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
| Verificación | [radar.real.test.ts](../../tests/real/radar.real.test.ts), escenario 1 |
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
| Verificación | Prueba propuesta: detener Redis y ejecutar las rutas de los demás módulos |
| Estado | Parcial. La estrategia de reintentos deja el servidor activo ([redis.ts](../../src/config/redis.ts)); no hay prueba automatizada del comportamiento degradado |

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
| Estado | No cumplido. Hoy la respuesta es un 500 genérico y no hay ruta de salud; observado el 2026-10-10, ver [RESULTADOS_VERIFICACION.md](../migracion/RESULTADOS_VERIFICACION.md) |

## EC-08 Modificabilidad: extraer el radar

| Elemento | Descripción |
|---|---|
| Fuente | Desarrollador |
| Estímulo | Mover el módulo de radar a un proceso independiente |
| Entorno | Tiempo de desarrollo |
| Elemento afectado | Módulo de radar, configuración y entrada de la API |
| Respuesta esperada | El cambio no modifica el código de los demás módulos ni el contrato que consume el frontend |
| Medida | **Objetivo pendiente de validación:** cero archivos modificados en otros módulos; las pruebas existentes del radar pasan sin cambios en sus aserciones |
| Verificación | Revisión del cambio y ejecución de [radar.real.test.ts](../../tests/real/radar.real.test.ts) |
| Estado | Propuesto. Favorable por análisis: el radar no importa de otros módulos ni usa PostgreSQL |

## EC-09 Rendimiento: consulta del radar

| Elemento | Descripción |
|---|---|
| Fuente | Estudiante |
| Estímulo | Consulta el estado del campus |
| Entorno | Servicio activo, no en arranque en frío |
| Elemento afectado | `GET /radar/status` |
| Respuesta esperada | Estado consolidado de los siete puntos en una sola respuesta |
| Medida | **Objetivo pendiente de validación:** percentil 95 inferior a 500 ms con 50 usuarios simultáneos |
| Verificación | Prueba de carga por definir |
| Estado | Sin medir. El código usa una sola ida y vuelta a Redis mediante *pipeline* ([radar.repository.ts](../../src/modules/radar/radar.repository.ts)) |

## EC-10 Operabilidad: migración fallida

| Elemento | Descripción |
|---|---|
| Fuente | Operador |
| Estímulo | Ejecuta una migración con un error de SQL |
| Entorno | Base de datos con datos existentes |
| Elemento afectado | Migrador |
| Respuesta esperada | La migración se revierte por completo, no se registra como aplicada y el proceso termina con código distinto de cero |
| Medida | Cero cambios parciales; código de salida 1 |
| Verificación | [migrations.real.test.ts](../../tests/real/migrations.real.test.ts), escenario 14 |
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
| Verificación | Ejecutar [diagnostico-conexiones.js](../../scripts/diagnostico-conexiones.js) y las comprobaciones de [Observabilidad y recuperación](../05-despliegue-y-operacion/04-observabilidad-y-recuperacion.md) |
| Estado | Parcial. Hay un script de diagnóstico; no hay registro del tiempo real de recuperación |

[← Índice](../README.md)
