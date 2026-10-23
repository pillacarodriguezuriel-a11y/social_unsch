# Atributos de calidad

Un atributo de calidad describe cómo debe comportarse el sistema, no qué hace. Aquí se listan los que más pesan en SOCIAL-UNSCH, qué mecanismo existe hoy para cada uno y qué falta. Los escenarios medibles están en [Escenarios de calidad](08-escenarios-de-calidad.md).

Ningún atributo tiene hoy una medición registrada en el repositorio: no hay pruebas de carga, monitoreo ni registro de disponibilidad. Lo que se indica como «existe» es un mecanismo en el código, no un resultado medido.

## Prioridad

| Prioridad | Atributo | Por qué importa en este sistema |
|---|---|---|
| 1 | Seguridad | Maneja credenciales y datos de contacto de miembros de la universidad |
| 2 | Integridad de datos | Asientos, interacciones y catálogos no deben quedar en estados contradictorios |
| 3 | Modificabilidad | El proyecto debe poder dividirse en servicios sin reescribirse |
| 4 | Disponibilidad | El radar solo es útil si responde cuando el estudiante lo consulta |
| 5 | Capacidad de prueba | La migración gradual exige comprobar que nada se rompe en cada paso |
| 6 | Rendimiento | Relevante para el radar y el feed; sin mediciones todavía |
| 7 | Operabilidad | Una sola persona opera el sistema con planes de bajo costo |

## Qué existe y qué falta

### Seguridad

| Mecanismo | Estado | Evidencia |
|---|---|---|
| Contraseñas con bcrypt, factor de costo 12 | Implementado | [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) |
| Tokens RS256 con vigencia de 24 horas | Implementado | [jwt.ts](../../apps/api/src/config/jwt.ts) |
| Mismo mensaje para correo inexistente y contraseña incorrecta | Implementado | [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) |
| Cabeceras de seguridad con Helmet y lista de orígenes CORS | Implementado | [app.ts](../../apps/api/src/app.ts) |
| Consultas parametrizadas | Implementado | Repositorios en [src/modules](../../apps/api/src/modules) |
| Restricción de dominio de correo también en la base de datos | Implementado | Restricción `chk_users_institutional_email` en [001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql) |
| Verificación de propiedad del correo | No existe | Declarado como pendiente en [roles.ts](../../apps/api/src/shared/auth/roles.ts) |
| Revocación de tokens o cierre de sesión en servidor | No existe | El cierre de sesión solo borra `localStorage` |
| Límite de intentos o de frecuencia | No existe | Sin middleware de limitación en [app.ts](../../apps/api/src/app.ts) |
| Autorización por rol en la API | No existe | Solo `requireAuth`; ver [Actores](02-actores.md) |
| Token fuera del alcance de scripts | No existe | El token se guarda en `localStorage` ([api.ts](../../apps/web/app/lib/api.ts)) |

### Integridad de datos

| Mecanismo | Estado | Evidencia |
|---|---|---|
| Confirmación de asiento en una transacción con bloqueo de filas | Implementado | `confirmBookingTransaction` en [carpooling.repository.ts](../../apps/api/src/modules/carpooling/carpooling.repository.ts) |
| Unicidad de solicitud activa por ruta y pasajero | Implementado, con una condición | Índice `uq_active_carpooling_request` en [005_canonical_extensions.sql](../../apps/api/src/database/migrations/sql/005_canonical_extensions.sql); la migración omite el índice si ya hay duplicados |
| Interacción de matchmaking en una transacción | Implementado | `submitInteraction` en [matchmaking.repository.ts](../../apps/api/src/modules/matchmaking/matchmaking.repository.ts) |
| Voto de radar atómico | Implementado | Script Lua en [radar.repository.ts](../../apps/api/src/modules/radar/radar.repository.ts) |
| Migraciones transaccionales con validación de estructura | Implementado | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) |

Los límites exactos de estas garantías se analizan en [Errores y consistencia](../03-diseno-de-software/06-errores-y-consistencia.md).

### Modificabilidad

| Mecanismo | Estado | Evidencia |
|---|---|---|
| Módulos por dominio sin importaciones entre sí | Implementado | Ningún archivo de `src/modules/*` importa de otro módulo |
| Capas controlador, servicio y repositorio | Implementado en seis de siete módulos | `catalogs` consulta la base desde el controlador |
| Dependencias invertidas mediante interfaces | No existe | Los servicios instancian sus repositorios; ver [Estilos y enfoques](../02-arquitectura-de-software/02-estilos-y-enfoques.md) |
| Independencia de datos entre módulos | No existe | Feed, matchmaking y carpooling consultan la tabla `users` directamente |

### Disponibilidad y operabilidad

| Mecanismo | Estado | Evidencia |
|---|---|---|
| El servidor sigue activo si Redis no está disponible | Implementado | Estrategia de reintentos en [redis.ts](../../apps/api/src/config/redis.ts) |
| Cierre ordenado ante `SIGTERM` | Parcial | [server.ts](../../apps/api/src/server.ts) cierra el servidor HTTP, no las conexiones a PostgreSQL y Redis |
| Rutas de salud | Implementado en la etapa 3 | `GET /health/live` y `GET /health/ready` ([health.routes.ts](../../apps/api/src/health/health.routes.ts)) |
| Registro estructurado, métricas, alertas | No existe | Solo `console.log` y `console.error` |

### Capacidad de prueba

| Mecanismo | Estado | Evidencia |
|---|---|---|
| Pruebas unitarias y de rutas con dobles | Implementado | [tests/unit](../../apps/api/tests/unit), [tests/integration](../../apps/api/tests/integration) |
| Pruebas contra PostgreSQL y Redis reales en contenedores | Implementado | [tests/real](../../apps/api/tests/real), [jest.real.config.ts](../../apps/api/jest.real.config.ts) |
| Umbral de cobertura del 90 % | Implementado | [jest.config.ts](../../apps/api/jest.config.ts) |
| Pruebas del frontend y de extremo a extremo | No existe | Sin configuración |
| Integración continua | No existe | Sin directorio `.github/workflows` |

[← Índice](../README.md)
