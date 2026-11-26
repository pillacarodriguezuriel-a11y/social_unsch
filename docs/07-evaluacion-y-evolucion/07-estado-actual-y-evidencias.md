# Estado actual y evidencias

> **Estado de referencia vigente: [Cierre de la migración](../migracion/ETAPA_08_CIERRE_MIGRACION.md) (2026-11-25).** `main` está en `452f9d6` con las etapas 1 a 7 fusionadas (PR #7, #8, #9, #10 y #11; nota: `main` `452f9d6` falló `test-real` y `e2e-feed` en CI [45492869658](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45492869658), corregido en `codex/etapa-8-cierre-migracion` `f93847c`). Los servicios `apps/radar` y `apps/feed` están implementados y probados, **ninguno desplegado**; en producción siguen `RADAR_MODE=local` y `FEED_MODE=local`. La observación de producción del **2026-11-25** ([etapa8-production-2026-11-25.json](../migracion/evidencias/etapa8-production-2026-11-25.json)) confirmó Vercel `/login` 200 (1,06 s), API `/health/live` 200 (32,67 s en frío), `/health/ready` 200 `ready` (`database: up`, `radar: up`, sin `feed`), `/api/v1/catalogs` 200, `/api/v1/radar/status` 401, `/api/v1/feed` 401, y 404 en los dominios previstos para Radar y Feed; **el SHA activo en Render sigue sin confirmar**. El periodo de observación de 14 días no ha comenzado para ninguno de los dos servicios.
>
> Los resultados históricos que siguen conservan su alcance temporal; la fotografía es del 2026-10-30.

Fotografía verificable del 2026-10-30. No incluye credenciales: no se leyó ningún archivo `.env`.

## Repositorio

| Dato | Valor |
|---|---|
| Rama de referencia | `main` |
| Commit del código | `b763885`, fusión del PR n.º 5 (2026-10-30, 13:07 UTC) |
| Commit anterior de `main` | `96783ef` (fusión del PR n.º 4) |
| Fusión | Se hizo con `test-real` en rojo |
| Pull requests abiertos | Ninguno de la etapa 4 |
| Workspaces | `packages/contracts`, `apps/api`, `apps/web`, `apps/radar` |

Archivos sin seguimiento presentes al revisar, ajenos a este trabajo: `Social_UNSCH_Propuesta_Tecnica_y_Arquitectura.docx`, `TEST_REPORT.md`, `documento_qa/`, `reporte_despliegue_y_pendientes.md` y `skill/Social_unsch_informe/`. Los dos informes en Markdown se leyeron como contexto; describen estados antiguos, anteriores al monorepo.

## Módulos y rutas

| Módulo | Rutas | Almacén | Autenticación |
|---|---|---|---|
| `auth` | `POST /register`, `POST /login`, `GET /profile-me` | PostgreSQL | Solo `profile-me` |
| `users` | `PATCH /accept-terms` | PostgreSQL | Sí |
| `catalogs` | `GET /`, `GET /schools` | PostgreSQL | No |
| `radar` | `GET /status`, `POST /report` | Redis | Sí |
| `feed` | `GET /`, `POST /` | PostgreSQL | Sí |
| `matchmaking` | `POST /score`, `GET /profiles`, `POST /interact` | PostgreSQL | Sí |
| `carpooling` | `GET /`, `POST /:route_id/request`, `PATCH /:route_id/confirm` | PostgreSQL | Sí |

Son 16 rutas bajo `/api/v1`, más `/health/live` y `/health/ready`. Definición: [app.ts](../../apps/api/src/app.ts).

## Migraciones

| Elemento | Valor |
|---|---|
| Migraciones versionadas | 5 archivos en [sql/](../../apps/api/src/database/migrations/sql/001_base_schema.sql) |
| Tablas de negocio | 16, más `schema_migrations` |
| Registro y bloqueo | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) |
| Aplicación en producción | Parcialmente verificada: tablas de catálogo operativas; `schema_migrations` e índice de carpooling sin comprobar |

## Pruebas y compilación

> **Actualización 2026-11-23.** Resultados del [cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md), en la rama `feat/etapa-5-validacion-radar`:
>
> | Comprobación | Local | CI |
> |---|---|---|
> | `npm run verify` | Correcto: 452 + 61 + 14 pruebas | Correcto, [45215241769](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45215241769) |
> | `npm run test:real` | 36 de 36 | 36 de 36, [45215241769](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45215241769) |
> | `npm run test:e2e` | 14 de 14 | 14 de 14, [45215241769](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45215241769) |
>
> La tabla siguiente conserva la comprobación del 2026-10-30.


| Comprobación | Resultado | Procedencia |
|---|---|---|
| Límites (`check:boundaries`) | Sin infracciones | Local, 2026-10-30 |
| API | 448 de 448 | Local, 2026-10-30 |
| Radar | 59 de 59 | Local, 2026-10-30 |
| Web | 14 de 14 | Local, 2026-10-30 |
| Tipos, cobertura y compilación (`npm run verify`) | Correcto | CI, job `verify`, 2026-10-23 y 2026-10-30 |
| Pruebas reales (`test:real`) | **Fallido** en CI, también en `main`. No ejecutadas en local: Docker no estaba activo | CI, job `test-real`, 2026-10-23 y 2026-10-30 |

Cobertura en [Métricas](06-metricas.md). Ejecuciones: [39985651148](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/39985651148) en el PR y [41060703064](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/41060703064) en `main`.

## Producción y salud

> **Actualización 2026-11-23.** `GET /health/ready` respondió **503 con `database: down` y `radar: up`**, y `GET /health/live` no respondió en 70 s. PostgreSQL de producción no estaba disponible; el panel de Supabase no es accesible desde este trabajo. El servicio Radar previsto seguía respondiendo 404.


Solicitudes GET de solo lectura, 2026-10-30, 12:51 y 13:10 UTC. La tabla muestra la primera; la segunda, tras la fusión, repitió los resultados de salud y de Radar.

| Comprobación | Resultado | Qué demuestra |
|---|---|---|
| API `/health/live` | 200 en 32,6 s | La API opera y se suspende por inactividad |
| API `/health/ready` | `ready`, `database: up`, `radar: up` | Incluye la etapa 3; PostgreSQL y Redis responden |
| `/api/v1/catalogs/schools` | 200 con datos | Catálogos cargados |
| `/api/v1/radar/status` sin token | 401 `ERR_AUTH_TOKEN_MISSING` | Guarda activa |
| Radar `social-unsch-radar.onrender.com/health/live` | 404 | El servicio no existe con ese nombre |
| Cabecera `x-request-id` en la API, 13:10 UTC | Presente | La API desplegada incluye código de la etapa 4 |
| Vercel `/login` | 200 | Frontend operativo |
| Último despliegue de producción en GitHub | `b763885` | La web corresponde a `main` |

No se usó ninguna cuenta ni se escribió en producción. El commit exacto de la API en Render no se pudo determinar.

## Infraestructura documentada

| Pieza | Estado |
|---|---|
| `docker-compose.yml` | PostgreSQL 15 y Redis 7 para desarrollo |
| CI | [ci.yml](../../.github/workflows/ci.yml), solo en `push` a `main` y PR hacia `main` |
| `vercel.json`, `render.yaml`, `Dockerfile` | No existen; la configuración vive en los paneles |
| Paneles de Vercel, Render, Supabase y Upstash | Sin acceso; ver [Mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md) |

## Estado por etapa

| Etapa | Estado |
|---|---|
| 1 y 2 | IMPLEMENTADO |
| 3 | IMPLEMENTADO, en producción |
| 4 | IMPLEMENTADO PARCIALMENTE: separación validada en local y CI; servicio sin desplegar |
| 5 a 8 | PROPUESTO |

Ver también: [Pendientes](08-pendientes.md) · [Métricas](06-metricas.md) · [Plan de migración](03-plan-de-migracion.md)

[← Índice](../README.md)
