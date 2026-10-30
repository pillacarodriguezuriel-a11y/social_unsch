# Requisitos funcionales

Cada requisito indica su estado, revisado el 2026-10-30 sobre `f480728`, y el archivo que lo sustenta. La etapa 4 no cambió ningún requisito funcional: mueve Radar, no añade funciones. Una pantalla o una tabla no cuentan por sí solas como requisito implementado: se exige un flujo completo con persistencia compartida.

Todas las rutas llevan el prefijo `/api/v1`, registrado en [app.ts](../../apps/api/src/app.ts).

## Identidad y acceso

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-001 | Registrar una cuenta con correo `@unsch.edu.pe`, nombre y contraseña robusta | Implementado | `POST /auth/register` · [auth.validators.ts](../../apps/api/src/modules/auth/auth.validators.ts), [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) |
| RF-002 | Impedir que el registro público asigne el rol administrador | Implementado | [roles.ts](../../apps/api/src/shared/auth/roles.ts) |
| RF-003 | Iniciar sesión y emitir un token de 24 horas | Implementado | `POST /auth/login` · [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts), [jwt.ts](../../apps/api/src/config/jwt.ts) |
| RF-004 | Exigir token válido en las rutas protegidas | Implementado | [auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts) |
| RF-005 | Registrar la aceptación de términos y exigirla para usar la plataforma | Parcial | `PATCH /users/accept-terms` guarda la aceptación ([users.repository.ts](../../apps/api/src/modules/users/users.repository.ts)); la exigencia solo se aplica en el navegador ([RouteGuard.tsx](../../apps/web/components/ui/RouteGuard.tsx)) |
| RF-006 | Consultar facultades, escuelas y pabellones con sus identificadores reales | Implementado | `GET /catalogs`, `GET /catalogs/schools` · [catalogs.controller.ts](../../apps/api/src/modules/catalogs/catalogs.controller.ts) |

## Radar del campus

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-007 | Consultar el estado vigente de comedor, rectorado, cuatro pisos de biblioteca y alerta de campus | Implementado | `GET /radar/status` · [radar.repository.ts](../../apps/api/src/modules/radar/radar.repository.ts) |
| RF-008 | Reportar un estado; actualizarlo al reunir tres votos de usuarios distintos, con vigencia de 15 minutos | Implementado | `POST /radar/report` · [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts), [radar.repository.ts](../../apps/api/src/modules/radar/radar.repository.ts) |

## Comunidad

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-009 | Listar publicaciones visibles con filtros por facultad y escuela y paginación | Parcial | `GET /feed` implementa filtros y paginación ([feed.service.ts](../../apps/api/src/modules/feed/feed.service.ts)); la pantalla no los envía ([page.tsx](../../apps/web/app/%28dashboard%29/page.tsx)) |
| RF-010 | Crear una publicación de hasta 2000 caracteres | Implementado | `POST /feed` · [feed.service.ts](../../apps/api/src/modules/feed/feed.service.ts) |
| RF-011 | Listar perfiles de matchmaking que el usuario aún puede evaluar | Implementado | `GET /matchmaking/profiles` · [matchmaking.repository.ts](../../apps/api/src/modules/matchmaking/matchmaking.repository.ts) |
| RF-012 | Registrar interés o descarte; ante interés mutuo, revelar el contacto | Parcial | `POST /matchmaking/interact` funciona; el identificador de chat devuelto no corresponde a ningún servicio de chat |
| RF-013 | Calcular la afinidad entre las habilidades del usuario y un proyecto | Parcial | `POST /matchmaking/score` existe ([matchmaking.service.ts](../../apps/api/src/modules/matchmaking/matchmaking.service.ts)); el frontend no lo invoca y no hay API para crear proyectos |
| RF-014 | Crear y editar el perfil de matchmaking propio | No implementado | No existe ruta; los perfiles solo se crean con el seed de demostración ([load_demo_seed.ts](../../apps/api/src/database/migrations/load_demo_seed.ts)) |

## Movilidad

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-015 | Listar rutas con asientos disponibles, con filtro por distrito de origen | Parcial | `GET /carpooling` existe; la pantalla usa `localStorage` ([CarpoolingDashboard.tsx](../../apps/web/components/ui/CarpoolingDashboard.tsx)) |
| RF-016 | Solicitar un asiento sin duplicados ni autoreserva | Parcial | `POST /carpooling/:route_id/request` · [carpooling.service.ts](../../apps/api/src/modules/carpooling/carpooling.service.ts); la pantalla simula la espera ([RouteBooking.tsx](../../apps/web/components/ui/RouteBooking.tsx)) |
| RF-017 | Confirmar un asiento solo por el conductor, descontándolo y revelando contactos | Parcial | `PATCH /carpooling/:route_id/confirm` · [carpooling.repository.ts](../../apps/api/src/modules/carpooling/carpooling.repository.ts); sin consumo desde la pantalla |
| RF-018 | Publicar una ruta de carpooling | Simulado | No existe ruta de API; la tabla `carpooling_routes` solo recibe datos por pruebas o inserción directa |

## Recursos, convivencia y otros

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-019 | Subir y descargar material académico con economía de créditos | Simulado | Pantalla con `localStorage` ([wiki-files/page.tsx](../../apps/web/app/%28dashboard%29/wiki-files/page.tsx)); tablas y disparador sin API ([003_credits_and_wiki.sql](../../apps/api/src/database/migrations/sql/003_credits_and_wiki.sql)) |
| RF-020 | Reportar publicaciones y ocultarlas al alcanzar tres reportes por el mismo motivo | Simulado | Pantalla con `localStorage` ([ModerationConsole.tsx](../../apps/web/components/ui/ModerationConsole.tsx)); tablas y disparador sin API ([004_moderation_and_carpooling.sql](../../apps/api/src/database/migrations/sql/004_moderation_and_carpooling.sql)) |
| RF-021 | Publicar y consultar artículos en un marketplace | Simulado | [marketplace/page.tsx](../../apps/web/app/%28dashboard%29/marketplace/page.tsx); sin API ni tablas |
| RF-022 | Consultar ofertas de empleo | Simulado | [jobs/page.tsx](../../apps/web/app/%28dashboard%29/jobs/page.tsx); sin API ni tablas |
| RF-023 | Editar perfil, privacidad y notificaciones | Simulado | [settings/page.tsx](../../apps/web/app/%28dashboard%29/settings/page.tsx) guarda en `localStorage`; no existe ruta de actualización de perfil |

## Requisitos de operación

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RO-001 | Evolucionar el esquema con migraciones versionadas, registradas y con bloqueo contra ejecuciones simultáneas | Implementado | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) |
| RO-002 | Sincronizar catálogos sin alterar identificadores existentes | Implementado | [load_catalogs.ts](../../apps/api/src/database/migrations/load_catalogs.ts) |
| RO-003 | Impedir la carga de datos de demostración fuera de un entorno local | Implementado | [load_demo_seed.ts](../../apps/api/src/database/migrations/load_demo_seed.ts) |

## Resumen

| Estado | Cantidad (RF) |
|---|---|
| Implementado | 9 |
| Parcial | 7 |
| Simulado | 6 |
| No implementado | 1 |

La relación con historias, pruebas y etapas está en la [matriz de trazabilidad](09-matriz-de-trazabilidad.md).

[← Índice](../README.md)
