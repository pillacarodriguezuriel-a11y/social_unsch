# Etapa 7 · Extracción controlada del dominio Feed

| Campo | Valor |
|---|---|
| Rama | `codex/etapa-7-extraccion-feed` |
| Base | `codex/etapa-6-desacoplamiento-feed` |
| Fecha | 2026-11-24 |
| Estado | **Implementado — pendiente de merge y despliegue** |
| Decisión | [ADR-010](../06-decisiones-arquitectonicas/ADR-010-extraccion-feed-servicio-independiente.md) |

---

## Restricciones operativas activas

> Estas restricciones **permanecen en efecto** mientras el PR esté en borrador o sin aprobación:

- **No se ejecutan migraciones sobre Supabase ni se modifican variables de Render, Vercel o Upstash.**
- **No se contratan recursos ni se cambian variables remotas.**
- **No se hace merge ni despliegue a producción en esta fase.**
- **El PR permanece en borrador mientras existan dependencias o criterios pendientes.**
- **No se declara que Feed está desplegado; solo está implementado y probado localmente.**
- **No se declara finalizada toda la migración al completar esta fase.**

---

## Objetivo

Extraer el dominio Feed de `apps/api` a un servicio Express independiente (`apps/feed`) activable mediante `FEED_MODE=proxy`, garantizando:

1. Lógica de negocio única en `packages/feed-domain` (sin duplicación entre la API y el servicio).
2. Seguridad RS256: `apps/feed` verifica JWT con clave pública únicamente; nunca confía en `x-user-id`.
3. La API permanece funcional en modo local por defecto; el proxy es un interruptor de entorno.
4. Cobertura de tests ≥ 90 % en todos los módulos nuevos.
5. CI integrado con job `e2e-feed`.

---

## Cambios realizados

### Nuevo: `packages/feed-domain`

| Archivo | Propósito |
|---|---|
| `src/ports.ts` | Interfaces `IFeedPost`, `IAuthorMeta`, `IAuthorMetaReader`, `IFeedRepository` |
| `src/errors.ts` | `FeedError` con `statusCode` y `errorCode` (sin dependencia de `AppError`) |
| `src/feed.service.ts` | `FeedService`: validación, XSS, paginación — única fuente de verdad del dominio |
| `src/index.ts` | Barrel: exporta todo |
| `package.json` | `@social-unsch/feed-domain` v1.0.0, CommonJS, sin dependencias de runtime |
| `tsconfig.json` | CommonJS, `declaration: true` |

### Nuevo: `apps/feed`

| Archivo | Propósito |
|---|---|
| `src/config/env.ts` | `loadFeedConfig()`: valida PORT, DATABASE_URL, JWT_PUBLIC_KEY, ALLOWED_ORIGINS |
| `src/config/database.ts` | `createFeedPool()`: pool pg (máx 10, idle 30 s, timeout 5 s) |
| `src/middlewares/auth.middleware.ts` | `createFeedAuthGuard()`: RS256, solo clave pública, rechaza `x-user-id` |
| `src/middlewares/logging.middleware.ts` | Logging estructurado, `x-request-id`, sin registrar `Authorization` |
| `src/middlewares/error.middleware.ts` | Maneja `FeedError` del dominio compartido |
| `src/health/health.routes.ts` | `/health/live` (200 siempre), `/health/ready` (verifica PostgreSQL) |
| `src/modules/feed/adapters/pg-author-meta.adapter.ts` | `PgAuthorMetaAdapter implements IAuthorMetaReader` |
| `src/modules/feed/feed.repository.ts` | `FeedRepository implements IFeedRepository` (named queries `feed-svc-*`) |
| `src/modules/feed/feed.controller.ts` | Usa `FeedService` de `@social-unsch/feed-domain`, lee `req.user.userId` |
| `src/modules/feed/feed.module.ts` | `createFeedModule({pool, authGuard})` retorna Router |
| `src/app.ts` | `createFeedApp()`: monta `/health`, `/api/v1/feed` |
| `src/server.ts` | Bootstrap + graceful shutdown (`server.close()` → `pool.end()`) |

#### Tests de `apps/feed`

| Archivo | Cobertura |
|---|---|
| `tests/unit/feed.service.test.ts` | 11+ pruebas de `FeedService` |
| `tests/unit/feed.repository.test.ts` | 7 pruebas de `FeedRepository` con pool y autor mock |
| `tests/unit/auth.middleware.test.ts` | 7 pruebas: sin token, malformado, manipulado, expirado, válido, x-user-id ignorado |
| `tests/unit/env.test.ts` | 7 pruebas de `loadFeedConfig()` |

### Modificado: `apps/api`

| Archivo | Cambio |
|---|---|
| `src/modules/feed/ports.ts` | Re-exporta desde `@social-unsch/feed-domain` |
| `src/modules/feed/feed.service.ts` | Re-exporta `FeedService` desde `@social-unsch/feed-domain` |
| `src/modules/feed/feed.repository.ts` | Importa interfaces desde `@social-unsch/feed-domain` |
| `src/modules/feed/adapters/pg-author-meta.adapter.ts` | Importa desde `@social-unsch/feed-domain` |
| `src/modules/feed/feed.controller.ts` | Importa `FeedService` desde `@social-unsch/feed-domain` |
| `src/modules/feed/feed.module.ts` | Importa `FeedService` desde `@social-unsch/feed-domain` |
| `src/modules/feed/feed.proxy.ts` | **Nuevo**: proxy nativo http/https con keep-alive, timeout, códigos de error explícitos |
| `src/config/env.ts` | Agrega `FeedMode`, `FEED_MODE`, `FEED_PROXY_TARGET`, `FEED_PROXY_TIMEOUT_MS` |
| `src/composition.ts` | Elige `feedRouter` según `config.feed.mode` |
| `src/middlewares/error.middleware.ts` | Maneja también `FeedError` |
| `jest.config.ts` | Mapea `@social-unsch/feed-domain`, agrega `feed.proxy.ts` a coverage |
| `package.json` | Agrega `@social-unsch/feed-domain` como dependencia |

### Actualizado: raíz del monorepo

| Archivo | Cambio |
|---|---|
| `package.json` | Agrega `packages/feed-domain` y `apps/feed` a workspaces; scripts `build:feed`, `start:feed`, `test:e2e:feed`, `build:feed-domain`, `test:feed` |
| `scripts/check-boundaries.js` | Reglas: `feed-sin-api`, `feed-sin-web`, `feed-domain-puro` |
| `scripts/check-boundaries.test.js` | Tests para las tres nuevas reglas |
| `scripts/lib/feed-stack.js` | Infraestructura E2E: `FeedInfra`, `feedProcess`, `apiProcess` extendido |
| `tests/e2e/feed.e2e.test.js` | Suite E2E completa: auth, GET/POST, paridad proxy↔local, acceso directo |
| `.github/workflows/ci.yml` | Job `e2e-feed`: compila feed-domain + api + feed, luego `test:e2e:feed` |

---

## Criterios de verificación

| Criterio | Estado |
|---|---|
| `npm run verify` pasa sin errores (límites, tipos, cobertura ≥ 90 %, builds) | Pendiente de ejecutar |
| `npm run test:boundaries` detecta las tres nuevas reglas | Pendiente de ejecutar |
| `apps/feed` compila sin errores TypeScript | Pendiente de ejecutar |
| Tests unitarios de `apps/feed` pasan con cobertura ≥ 90 % | Pendiente de ejecutar |
| `apps/api` en modo proxy redirige correctamente a `apps/feed` | Verificado en diseño |
| `apps/api` en modo local no depende de `apps/feed` | Verificado en diseño |
| `apps/feed` rechaza `x-user-id` sin token (demostrado en E2E) | Verificado en diseño |
| PR creado como borrador | Pendiente |

---

## Estado del despliegue

| Entorno | Estado |
|---|---|
| Local (modo local, `FEED_MODE` no seteado) | Funcional tras `npm install` |
| Local (modo proxy, `FEED_MODE=proxy`) | Funcional tras compilar `apps/feed` |
| Supabase / Render / Vercel | **Sin cambios — no se activa en esta fase** |

---

## Siguiente etapa

La Etapa 8 activará `apps/feed` en producción una vez que:
1. `apps/radar` esté en producción y los 14 días de observación completados.
2. Las pruebas E2E pasen en CI en al menos una versión de Node LTS.
3. El PR de esta etapa esté aprobado y mergeado a `main`.
4. Se hayan reservado recursos de despliegue para `apps/feed`.
