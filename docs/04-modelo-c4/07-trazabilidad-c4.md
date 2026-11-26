# Trazabilidad C4

Relaciona cada funcionalidad con su representación en los cuatro niveles y con el código real.

```text
Requisito → Dominio → Contenedor → Componente → Código
```

Referencia: `main`, commit `b763885`. El estado de cada requisito está en [Requisitos funcionales](../01-analisis-de-sistema/03-requisitos-funcionales.md). La relación con historias y pruebas está en la [matriz de trazabilidad](../01-analisis-de-sistema/09-matriz-de-trazabilidad.md).

## Funcionalidades con backend

| Funcionalidad | Nivel 1 | Nivel 2 | Nivel 3 | Nivel 4 | Código |
|---|---|---|---|---|---|
| Registro (RF-001, RF-002) | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `auth` | `AuthController.register`, `AuthService.register`, `AuthRepository.create` | [`apps/api/src/modules/auth`](../../apps/api/src/modules/auth/auth.service.ts) |
| Inicio de sesión y token (RF-003, RF-004) | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `auth`, `requireAuth`, `config/jwt` | `AuthService.login`, `signAccessToken`, `verifyAccessToken` | [`auth.service.ts`](../../apps/api/src/modules/auth/auth.service.ts), [`jwt.ts`](../../apps/api/src/config/jwt.ts) |
| Aceptación de términos (RF-005) | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `users`, `RouteGuard` | `UsersService.acceptTerms` | [`users.service.ts`](../../apps/api/src/modules/users/users.service.ts) |
| Catálogos (RF-006) | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `catalogs` | `CatalogsController.getCatalogs`, `loadCatalogs` | [`catalogs.controller.ts`](../../apps/api/src/modules/catalogs/catalogs.controller.ts) |
| Radar, consulta y reporte (RF-007, RF-008), modo local | SOCIAL-UNSCH, Redis | Web, API, Redis | `radar` | `RadarService`, `RadarStore`, `RadarRepository` | [`apps/api/src/modules/radar`](../../apps/api/src/modules/radar/radar.service.ts) |
| Radar, servicio independiente | SOCIAL-UNSCH, Redis | Web, API, Servicio Radar, Redis ([transición](05-contenedores-de-transicion.md)) | `radar` en proxy, componentes de `apps/radar` | `createRadarProxyModule`, `createRadarAuthGuard`, `RadarService` | [`radar.proxy.ts`](../../apps/api/src/modules/radar/radar.proxy.ts), [`apps/radar/src`](../../apps/radar/src/app.ts) |
| Feed (RF-009, RF-010), modo local | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `feed` | `FeedHttpHandlers`, `FeedService`, `PgFeedRepository` | [`packages/feed-domain`](../../packages/feed-domain/src/feed.service.ts), [`feed.module.ts`](../../apps/api/src/modules/feed/feed.module.ts) |
| Feed, servicio independiente | SOCIAL-UNSCH, PostgreSQL | Web, API, Servicio Feed, PostgreSQL ([transición](05-contenedores-de-transicion.md)) | `feed` en proxy, componentes de `apps/feed` | `createFeedProxyModule`, `createFeedAuthGuard`, los mismos `FeedHttpHandlers` y `FeedService` | [`feed.proxy.ts`](../../apps/api/src/modules/feed/feed.proxy.ts), [`apps/feed/src`](../../apps/feed/src/app.ts) |
| Matchmaking (RF-011 a RF-013) | SOCIAL-UNSCH, PostgreSQL | Web, API, PostgreSQL | `matchmaking` | `MatchmakingService`, `MatchmakingRepository.submitInteraction` | [`matchmaking.service.ts`](../../apps/api/src/modules/matchmaking/matchmaking.service.ts) |
| Carpooling (RF-015 a RF-017) | SOCIAL-UNSCH, PostgreSQL | API, PostgreSQL; la web no la consume | `carpooling` | `CarpoolingService.confirmSeat`, `confirmBookingTransaction` | [`carpooling.repository.ts`](../../apps/api/src/modules/carpooling/carpooling.repository.ts) |
| Salud | Render | API, Servicio Radar, Servicio Feed | Salud | `createHealthRouter`, `createRadarHealthRouter`, `createFeedHealthRouter` | [`apps/api`](../../apps/api/src/health/health.routes.ts), [`apps/radar`](../../apps/radar/src/health/health.routes.ts), [`apps/feed`](../../apps/feed/src/health/health.routes.ts) |
| Migraciones (RO-001 a RO-003) | Operador, PostgreSQL | Herramientas de migración, PostgreSQL | Migrador | `runMigrations`, `loadCatalogs` | [`migrator.ts`](../../apps/api/src/database/migrations/migrator.ts) |

## Funcionalidades sin backend

No tienen representación en los niveles 3 y 4 de la API.

| Funcionalidad | Nivel 2 | Código | Estado |
|---|---|---|---|
| Banco de archivos (RF-019) | Web, con `localStorage` | [`wiki-files/page.tsx`](../../apps/web/app/%28dashboard%29/wiki-files/page.tsx) | Simulado; tablas sin API |
| Moderación (RF-020) | Web, con `localStorage` | [`ModerationConsole.tsx`](../../apps/web/components/ui/ModerationConsole.tsx) | Simulado; tablas sin API |
| Marketplace (RF-021) | Web, con `localStorage` | [`marketplace/page.tsx`](../../apps/web/app/%28dashboard%29/marketplace/page.tsx) | Simulado |
| Empleo (RF-022) | Web, datos fijos | [`jobs/page.tsx`](../../apps/web/app/%28dashboard%29/jobs/page.tsx) | Simulado |
| Ajustes (RF-023) | Web, con `localStorage` | [`settings/page.tsx`](../../apps/web/app/%28dashboard%29/settings/page.tsx) | Simulado |
| Publicar ruta (RF-018) | Web, con `localStorage` | [`CarpoolingDashboard.tsx`](../../apps/web/components/ui/CarpoolingDashboard.tsx) | Simulado |
| Perfil de matchmaking (RF-014) | — | — | NO IMPLEMENTADO |

## Dominios y contenedores

| Dominio | Hoy | Objetivo | Estado de la separación |
|---|---|---|---|
| Identidad | Módulos `auth`, `users`, `catalogs` | Servicio propio | PROPUESTO; fuera del alcance de esta fase |
| Radar | Módulo `radar` y `apps/radar` | Servicio propio | IMPLEMENTADO PARCIALMENTE: código completo, **sin desplegar**. Logró separación de datos (Redis propio) |
| Comunidad · Feed | Módulo `feed`, `apps/feed` y `packages/feed-domain` | Servicio propio | IMPLEMENTADO PARCIALMENTE: código completo, **sin desplegar**. **No logró separación de datos:** comparte PostgreSQL y lee `users` |
| Comunidad · Matchmaking | Módulo `matchmaking` | Servicio propio o junto a Feed | PROPUESTO; fuera del alcance |
| Movilidad | Módulo `carpooling` | Servicio propio | PROPUESTO; **no ejecutado**, fuera del alcance ([ADR-011](../06-decisiones-arquitectonicas/ADR-011-cierre-de-la-migracion-y-alcance-final.md)) |
| Recursos | Sin módulo; tablas sin API | Servicio propio | PROPUESTO; **no ejecutado**, fuera del alcance |

Más detalle en [Dominios del sistema](../02-arquitectura-software/08-dominios-del-sistema.md).

[← Guía del modelo C4](README.md) · [← Índice](../README.md)
