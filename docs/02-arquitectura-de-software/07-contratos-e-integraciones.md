# Contratos e integraciones

Un **contrato** es el acuerdo entre quien ofrece una interfaz y quien la consume: rutas, datos de entrada y salida, y errores. Este documento describe el contrato vigente de la API y los que harían falta en la arquitectura propuesta.

## Contrato vigente: API REST

Hoy existe un único contrato: el de la API con la aplicación web. **No está formalizado**: no hay especificación OpenAPI ni tipos compartidos; el contrato está implícito en los controladores y en el uso que hace el frontend.

Convenciones observadas:

| Aspecto | Convención | Evidencia |
|---|---|---|
| Prefijo y versión | `/api/v1` | [app.ts](../../apps/api/src/app.ts) |
| Formato | JSON | [app.ts](../../apps/api/src/app.ts) |
| Autenticación | Cabecera `Authorization: Bearer <token>` | [auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts) |
| Errores | `{ "error": true, "message": "...", "code": "ERR_..." }` | [error.middleware.ts](../../apps/api/src/middlewares/error.middleware.ts) |
| Nombres de campos | `snake_case` | Controladores |

### Rutas

| Método y ruta | Protegida | Entrada | Respuesta correcta | Consumida por el frontend |
|---|---|---|---|---|
| `POST /auth/register` | No | `full_name`, `email`, `password`, `role`, `professional_school_id?`, `current_academic_cycle?` | 201 con `user_id` | Sí |
| `POST /auth/login` | No | `email`, `password` | 200 con `access_token`, `token_type`, `expires_in`, `user` | Sí |
| `GET /auth/profile-me` | Sí | — | 200 con el contenido del token | No |
| `PATCH /users/accept-terms` | Sí | — | 200 | Sí |
| `GET /catalogs` | No | — | 200 con `data.faculties`, `data.schools`, `data.pavilions` | Sí |
| `GET /catalogs/schools` | No | — | 200 con `data` | No |
| `GET /radar/status` | Sí | — | 200 con `comedor`, `rectorado`, `biblioteca`, `campus_alert` | Sí |
| `POST /radar/report` | Sí | `node`, `status` | 200 con `updated` y, si falta consenso, `votes_current` y `votes_required` | Sí |
| `GET /feed` | Sí | Consulta: `faculty_id?`, `school_id?`, `page?`, `limit?` | 200 con `data` | Sí, sin parámetros |
| `POST /feed` | Sí | `content`, `faculty_id?`, `school_id?` | 201 con `post_id` | Sí |
| `POST /matchmaking/score` | Sí | `project_id`, `user_skills` | 200 con puntuación y nivel | No |
| `GET /matchmaking/profiles` | Sí | — | 200 con `data` | Sí |
| `POST /matchmaking/interact` | Sí | `receiver_profile_id`, `action` | 200 con `match`, `status` y, si hay coincidencia, `contact_info` | Sí |
| `GET /carpooling` | Sí | Consulta: `origin_district?` | 200 con `data` | No |
| `POST /carpooling/:route_id/request` | Sí | — | 201 con `data` | No |
| `PATCH /carpooling/:route_id/confirm` | Sí | `passenger_id` | 200 con contactos de ambos | No |

De las 16 rutas, el frontend consume 10.

### Inconsistencias del contrato actual

Conviene corregirlas antes de congelar el contrato para la migración. Se documentan aquí como pendientes; no se han modificado.

| Inconsistencia | Detalle | Evidencia |
|---|---|---|
| Forma de la respuesta correcta no uniforme | Unas rutas devuelven `{ data }`, otras `{ success, message, ... }`, y el radar devuelve el objeto sin envoltura | Controladores de `feed`, `auth` y `radar` |
| Códigos de error de otro dominio | Matchmaking devuelve `ERR_FEED_POST_NOT_FOUND` cuando no encuentra un proyecto o perfil, y `ERR_MOD_SELF_REPORT` ante un autolike | [matchmaking.service.ts](../../apps/api/src/modules/matchmaking/matchmaking.service.ts) |
| Validación de entrada dispar | `auth` valida con esquemas Zod; `feed`, `radar` y `carpooling` validan a mano | Controladores respectivos |
| Dos códigos para el mismo caso | Campos ausentes devuelven `ERR_VALIDATION_INVALID_FIELDS` o `ERR_VALIDATION_MISSING_FIELDS` según el módulo | [radar.controller.ts](../../apps/api/src/modules/radar/radar.controller.ts), [carpooling.controller.ts](../../apps/api/src/modules/carpooling/carpooling.controller.ts) |
| Valores del radar en dos idiomas | El servicio acepta tanto `fluid` como `Fluido` para el mismo estado, y los cuenta como votos distintos | [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts) |
| Campo declarado y no emitido | El tipo del token declara `jti`, pero el inicio de sesión no lo incluye | [jwt.ts](../../apps/api/src/config/jwt.ts), [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) |

### Contrato del token

| Campo | Significado |
|---|---|
| `user_id` | Identificador UUID del usuario |
| `role` | Rol de la cuenta |
| `school_id`, `escuela_id` | Escuela profesional (el mismo valor, duplicado) |
| `facultad_id` | Facultad |
| `ciclo` | Ciclo académico |
| `has_accepted_terms` | Aceptación de términos en el momento del inicio de sesión |

Algoritmo RS256, vigencia de 24 horas ([jwt.ts](../../apps/api/src/config/jwt.ts)). Este contrato es el que permitirá a servicios futuros identificar al usuario sin consultar a nadie.

## Integraciones externas vigentes

| Integración | Protocolo | Sentido | Evidencia |
|---|---|---|---|
| API → PostgreSQL | Protocolo de PostgreSQL mediante `pg` | Lectura y escritura | [database.ts](../../apps/api/src/config/database.ts) |
| API → Redis | Protocolo de Redis mediante `ioredis`; TLS si la URL usa `rediss://` | Lectura y escritura | [redis.ts](../../apps/api/src/config/redis.ts) |
| Aplicación web → API | HTTPS y JSON mediante Axios | Solicitud y respuesta | [api.ts](../../apps/web/app/lib/api.ts) |

No hay integraciones con terceros (correo, mensajería, pagos, almacenamiento de archivos, sistemas de la universidad).

## Contratos propuestos

> **Estado: Propuesto.**

### Formalizar el contrato existente (etapa 3)

| Acción | Para qué |
|---|---|
| Describir las 16 rutas en una especificación OpenAPI | Tener una referencia verificable antes de mover código |
| Compartir los tipos entre frontend y backend en un paquete | Evitar que diverjan |
| Unificar la forma de respuesta y los códigos de error | Que la entrada de API y los clientes traten igual a todos los servicios |
| Pruebas de contrato sobre las rutas consumidas por el frontend | Detectar cambios incompatibles al extraer un servicio |

### Contratos entre servicios

| Contrato | Proveedor | Consumidor | Tipo | Contenido |
|---|---|---|---|---|
| Verificación de token | Identidad (publica la clave pública) | Todos | Configuración | Clave pública RS256 |
| Catálogos | Identidad | Todos | Consulta, admite caché | Facultades, escuelas, pabellones |
| Datos públicos de usuario | Identidad | Comunidad | Consulta o copia por eventos | Nombre y rol |
| Datos de contacto | Identidad | Movilidad, Comunidad | Consulta síncrona, solo tras acuerdo mutuo | Correo, teléfono, enlace de contacto |
| Usuario eliminado | Identidad | Todos | Evento | Identificador del usuario |
| Archivo descargado | Recursos | Recursos (contabilidad), Identidad si conserva el saldo | Evento | Archivo, comprador, costo |
| Publicación reportada | Comunidad | Comunidad (moderación) | Evento o transacción local | Publicación, motivo |

### Reglas propuestas para todos los contratos

- Versionado en la ruta, como hoy (`/api/v1`); un cambio incompatible crea `/api/v2`.
- Los eventos llevan identificador, tipo, fecha y versión; quien los consume debe tolerar duplicados.
- Los datos de contacto nunca viajan en listados ni en eventos.
- Un servicio no lee las tablas de otro, ni siquiera cuando compartan instancia.

[← Índice](../README.md)
