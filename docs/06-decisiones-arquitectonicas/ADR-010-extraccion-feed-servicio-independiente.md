# ADR-010 · Extracción del dominio Feed como servicio independiente

| Campo | Valor |
|---|---|
| Estado | **Propuesto — implementado en `codex/etapa-7-extraccion-feed`** |
| Fecha de documentación | 2026-11-24 |
| Rama de implementación | `codex/etapa-7-extraccion-feed` |
| Tipo | Decisión de la etapa 7 |
| Decisión anterior | ADR-009 (desacoplamiento interno del dominio Feed) |

---

## 1. Contexto

ADR-009 completó el desacoplamiento interno del dominio Feed: se introdujeron puertos (`IFeedRepository`, `IAuthorMetaReader`), la inyección de dependencias en el punto de composición (`composition.ts`) y los adaptadores PG. El módulo Feed dentro de `apps/api` está ahora listo para ser extraído sin romper la API.

La estrategia de migración gradual (ADR-003) establece que un dominio puede extraerse una vez que su interfaz interna está estabilizada y probada. Esta decisión registra cómo se ejecuta esa extracción.

### 1.1 Restricciones operativas activas

- `apps/radar` no está en producción; los 14 días de observación no han comenzado.
- No se hacen merges a `main` ni despliegues a producción en esta fase.
- La API sigue siendo el punto de entrada único; `apps/feed` no recibe tráfico externo todavía.
- Variables remotas (Supabase, Render, Vercel, Upstash) no se modifican.

---

## 2. Decisión

**Extraer el dominio Feed a un servicio Express independiente (`apps/feed`) en el puerto 4002, activable por la API mediante `FEED_MODE=proxy`.**

La API permanece en modo local por defecto; el modo proxy se activa mediante una variable de entorno, sin cambios en el código de enrutamiento (`app.ts`).

---

## 3. Consecuencias

### 3.1 Positivas

| Consecuencia | Detalle |
|---|---|
| Despliegue independiente | `apps/feed` puede escalar, desplegarse y reiniciarse sin afectar la API |
| Lógica de negocio única | `packages/feed-domain` concentra `FeedService` y los puertos; no hay duplicación |
| Seguridad reforzada | RS256 JWT verificado con clave pública únicamente; `x-user-id` nunca se acepta |
| Strangler Fig limpio | `composition.ts` elige entre local y proxy; `app.ts` no sabe nada del cambio |
| Reversibilidad | Bajar a `FEED_MODE=local` restaura el comportamiento anterior sin despliegue |

### 3.2 Negativas / Riesgos

| Riesgo | Mitigación |
|---|---|
| Latencia adicional en modo proxy | Keep-alive (64 sockets), sin reconexiones, timeout explícito de 5 s |
| Complejidad operativa aumenta | Se mitiga manteniendo el modo local como defecto hasta la estabilización |
| Pool de conexiones duplicado | `apps/feed` abre su propio pool (máx 10); se acota el impacto en Supabase free tier |
| Versionado de API interna | La ruta `/api/v1/feed` es compartida; cambios deben coordinarse |

---

## 4. Alternativas consideradas

| Alternativa | Razón para no elegirla |
|---|---|
| Extraer directamente sin paquete compartido | Duplica la lógica de validación y XSS; viola el principio de única fuente de verdad |
| Usar gRPC en lugar de HTTP REST | Incrementa la complejidad operativa sin beneficio observable a esta escala |
| Desplegar primero y extraer después | Invierte el orden: el código debe estar probado antes de recibir tráfico real |
| Monorepo con importación directa (sin proxy) | Rompe el aislamiento de despliegue; ambas apps deben compilarse juntas |

---

## 5. Estructura resultante

```
packages/
  feed-domain/          ← FeedService, IFeedRepository, IAuthorMetaReader, FeedError
apps/
  api/
    src/
      modules/feed/
        feed.proxy.ts   ← proxy nativo http/https (activado con FEED_MODE=proxy)
        feed.service.ts ← re-export de @social-unsch/feed-domain
        ports.ts        ← re-export de @social-unsch/feed-domain
      composition.ts    ← elige feedRouter según FEED_MODE
      config/env.ts     ← FEED_MODE, FEED_PROXY_TARGET, FEED_PROXY_TIMEOUT_MS
  feed/
    src/
      config/           ← env.ts, database.ts
      middlewares/      ← auth (RS256), logging, error
      health/           ← /health/live, /health/ready
      modules/feed/     ← feed.controller, feed.repository, feed.module, adapters/
      app.ts            ← createFeedApp()
      server.ts         ← bootstrap + graceful shutdown
```

---

## 6. Criterios de activación en producción

Esta decisión **no activa** el modo proxy en producción. Los criterios para ese paso son:

1. `apps/radar` debe estar en producción y estabilizado (observación completada).
2. Las pruebas E2E de feed (`npm run test:e2e:feed`) deben pasar en CI con al menos una versión de Node LTS.
3. El PR de esta etapa debe estar revisado y aprobado antes de mergear a `main`.
4. La variable `FEED_PROXY_TARGET` debe apuntar a un servicio desplegado y con `/health/ready` en verde.

---

## 7. Referencias

- [ADR-003](./ADR-003-migracion-gradual-por-dominios.md) — Estrategia de migración gradual
- [ADR-008](./ADR-008-extraccion-radar-servicio-independiente.md) — Extracción de Radar (patrón aplicado)
- [ADR-009](./ADR-009-desacoplamiento-dominio-feed.md) — Desacoplamiento previo del dominio Feed
- [ETAPA_07_EXTRACCION_FEED.md](../migracion/ETAPA_07_EXTRACCION_FEED.md) — Registro de implementación
