# Matriz de trazabilidad

La matriz conecta cada historia con su requisito, el módulo que lo realiza, el punto de entrada, la prueba existente y la etapa de evolución en la que se prevé completarlo o moverlo. Las etapas se describen en el [plan de migración](../07-evaluacion-y-evolucion/03-plan-de-migracion.md).

Convenciones:

- **Pruebas.** U: unitarias en [tests/unit](../../apps/api/tests/unit). I: de rutas con dobles en [tests/integration](../../apps/api/tests/integration). R: contra PostgreSQL y Redis reales en [tests/real](../../apps/api/tests/real). «Ninguna» significa que no hay prueba automatizada.
- **Etapa.** Indica dónde cambia la ubicación o el estado del requisito según la propuesta. «—» indica que no se prevé cambio.

## Identidad y acceso

| Historia | Requisito | Módulo | Endpoint o componente | Prueba existente | Etapa de evolución |
|---|---|---|---|---|---|
| [HU-01](03-historias-de-usuario.md) | RF-001, RF-002 | `auth` | `POST /auth/register` | U `auth.service`, `auth.validators`; I `auth.routes`; R `auth.real` | 5 (servicio de identidad) |
| HU-02 | RF-003, RF-004 | `auth`, middleware | `POST /auth/login`, `requireAuth` | U `auth.service`; I `auth.routes`; R `auth.real` | 5 |
| HU-03 | RF-005 | `users` | `PATCH /users/accept-terms`, `RouteGuard` | U `users.service`, `users.repository`; I `users.routes`. Sin prueba del bloqueo en el navegador | 3 (definir la exigencia en la API), 5 |
| HU-04 | RF-006 | `catalogs` | `GET /catalogs` | I `catalogs.routes`; R `migrations.real` escenario 11 | 5 |

## Radar

| Historia | Requisito | Módulo | Endpoint o componente | Prueba existente | Etapa de evolución |
|---|---|---|---|---|---|
| HU-05 | RF-007 | `radar` | `GET /radar/status` | U `radar.service`; I `radar.routes`; R `radar.real` | 4 (extracción de radar) |
| HU-06 | RF-008 | `radar` | `POST /radar/report` | U `radar.service`; I `radar.routes`; R `radar.real` | 4 |

## Comunidad

| Historia | Requisito | Módulo | Endpoint o componente | Prueba existente | Etapa de evolución |
|---|---|---|---|---|---|
| HU-07 | RF-009 | `feed` | `GET /feed` | U `feed.service`, `feed.repository`; I `feed.routes`; R `feed_matchmaking.real` | 5 (servicio de comunidad) |
| HU-08 | RF-010 | `feed` | `POST /feed` | U `feed.service`, `feed.repository`; I `feed.routes`; R `feed_matchmaking.real` | 5 |
| HU-09 | RF-011, RF-012 | `matchmaking` | `GET /matchmaking/profiles`, `POST /matchmaking/interact` | U `matchmaking.service`, `matchmaking.repository`; I `matchmaking.routes`; R `feed_matchmaking.real` | 5 |
| HU-09 | RF-013 | `matchmaking` | `POST /matchmaking/score` | U `matchmaking.service`; I `matchmaking.routes` | 5 |
| HU-09 | RF-014 | Sin módulo | Sin endpoint | Ninguna | 5 (requiere implementación) |
| HU-14 | RF-020 | Sin módulo; tablas y disparador en la base | `ModerationConsole` (simulado) | Ninguna | 5 (requiere implementación) |

## Movilidad

| Historia | Requisito | Módulo | Endpoint o componente | Prueba existente | Etapa de evolución |
|---|---|---|---|---|---|
| HU-10 | RF-015 | `carpooling` | `GET /carpooling` | U `carpooling.service`, `carpooling.repository`; I `carpooling.routes` | 6 (servicio de movilidad) |
| HU-10 | RF-016 | `carpooling` | `POST /carpooling/:route_id/request` | U, I; R `carpooling.real` escenarios 1, 2 y 7 | 6 |
| HU-11 | RF-017 | `carpooling` | `PATCH /carpooling/:route_id/confirm` | U, I; R `carpooling.real` escenarios 3 a 6 | 6 |
| HU-12 | RF-018 | Sin endpoint | `CarpoolingDashboard` (simulado) | Ninguna | 6 (requiere implementación) |

Las pruebas de carpooling ejercitan la API; no existe prueba de la pantalla, que hoy no la consume.

## Recursos y otras áreas

| Historia | Requisito | Módulo | Endpoint o componente | Prueba existente | Etapa de evolución |
|---|---|---|---|---|---|
| HU-13 | RF-019 | Sin módulo; tablas y disparador en la base | `wiki-files/page.tsx` (simulado) | Ninguna | 7 (recursos y créditos) |
| HU-15 | RF-021 | Sin módulo ni tablas | `marketplace/page.tsx` (simulado) | Ninguna | Sin etapa asignada |
| HU-16 | RF-022 | Sin módulo ni tablas | `jobs/page.tsx` (simulado) | Ninguna | Sin etapa asignada |
| HU-17 | RF-023 | Sin endpoint | `settings/page.tsx` (simulado) | Ninguna | 5 (requiere implementación) |

## Operación

| Necesidad | Requisito | Componente | Comando | Prueba existente | Etapa |
|---|---|---|---|---|---|
| Evolucionar el esquema | RO-001 | `migrator.ts` | `npm run db:migrate` | R `migrations.real` escenarios 1, 2, 5 a 7, 12 y 14 | 2 (ejecutada) |
| Sincronizar catálogos | RO-002 | `load_catalogs.ts` | `npm run db:catalogs` | R `migrations.real` escenarios 3 y 8 a 10 | 2 (ejecutada) |
| Datos de demostración seguros | RO-003 | `load_demo_seed.ts` | `npm run db:seed:demo` | R `migrations.real` escenarios 4 y 13 | 2 (ejecutada) |

## Lectura de la matriz

- Todo lo que tiene módulo en el backend tiene pruebas unitarias y de rutas; los flujos con riesgo de concurrencia tienen además pruebas contra servicios reales.
- Ninguna pantalla tiene pruebas automatizadas.
- Siete requisitos (RF-014, RF-018 a RF-023) no tienen implementación de servidor; para ellos la etapa indicada supone construir, no migrar.
- Marketplace y empleo no tienen etapa asignada en la propuesta de migración: el plan discutido no los menciona. Queda como decisión pendiente del propietario.

[← Índice](../README.md)
