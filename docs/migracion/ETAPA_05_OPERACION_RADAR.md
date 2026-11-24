# Etapa 5 · Recuperación operativa y despliegue controlado de Radar

| Dato | Valor |
|---|---|
| Fecha | **2026-11-23** (UTC: 2026-11-23 / 2026-11-24; zona local America/Bogota) |
| Rama de trabajo | `codex/etapa-5-operacion-radar` |
| Commit de código evaluado | `d616f9b` (construido sobre `main` `52e12dc` y los commits previos de la rama) |
| Estado de la fase | **ABIERTA · Preparación técnica completada.** Sin activación del proxy ni observación productiva de 14 días |
| Alcance | Recuperar línea base operativa, investigar y optimizar la sobrecarga del proxy, diseñar despliegue compatible, preparar activación A–G, reversión y observación de 14 días. **No se extraen Identidad, Comunidad ni otros dominios** |

Esta etapa actualiza el plan de migración por instrucción del propietario: no aprueba un cambio de arquitectura ni sustituye los umbrales acordados.

---

## 1. Línea base comprobada (sin asumir el informe anterior)

No existe `AGENTS.md` en el repositorio ni en `D:\`. Se conservaron todos los archivos sin seguimiento ajenos al alcance y los seis contenedores Docker de otros proyectos.

| Elemento | Comprobación real (2026-11-23) | Estado | Evidencia |
|---|---|---|---|
| Rama anterior `feat/etapa-5-validacion-radar` | Sigue disponible en `origin`, cabeza `7c5bd04` | **VERIFICADO EN CI** ([45216225249](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45216225249)) | [etapa5-baseline-github.json](evidencias/etapa5-baseline-github.json) |
| PR anterior | [#7](https://github.com/pillacarodriguezuriel-a11y/social_unsch/pull/7) fusionado a las 16:09:07Z (`324afd2`, sobre `723e283`); [#8](https://github.com/pillacarodriguezuriel-a11y/social_unsch/pull/8) fusionado a las 19:32:57Z (`52e12dc`, sobre `577cca6`) | Integrado en `main` | [etapa5-baseline-github.json](evidencias/etapa5-baseline-github.json) |
| CI en `main` (`52e12dc`) | `verify`, `test-real` y `e2e-radar` **correctos** | **VERIFICADO EN CI** ([45250089005](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45250089005)) | API GitHub Actions |
| Arreglos de resiliencia Redis (F-3 y F-4) | `commandTimeout: 1500` y propagación de errores del *pipeline* ya están en `main` desde PR #7 (`324afd2`) | En `main`; **DESPLEGADO no confirmado** sin acceso al panel de Render | `apps/api/src/config/redis.ts`, `radar.repository.ts` |
| API de producción (`social-unsch.onrender.com`) | Dos rondas GET independientes de solo lectura (19:23Z y 20:03Z): `/health/live` 200 (27,8 s en frío), `/health/ready` 200 `ready` (`database: up`, `radar: up`), `/api/v1/catalogs` 200, `/api/v1/radar/status` sin token 401 | **OBSERVADO EN PRODUCCIÓN** (puntual) | [ronda 1](evidencias/etapa5-production-2026-11-23.json) · [ronda 2](evidencias/etapa5-production-2026-11-23-r2.json) |
| Servicio Radar previsto (`social-unsch-radar.onrender.com`) | 404 en `/health/live`, `/health/ready` y `/api/v1/radar/status` en ambas rondas | **No verificado desplegado** (no prueba inexistencia bajo otro dominio) | [ronda 2](evidencias/etapa5-production-2026-11-23-r2.json) |
| Paneles Render / Supabase / Upstash / Vercel | Sin sesión ni credenciales disponibles | Información faltante | — |

**Decisión sobre PR independiente de Redis:** F-3 y F-4 ya fueron fusionados en `main` mediante el PR #7 (`324afd2`) y verificados en verde en `main` (`52e12dc`). No corresponde abrir un PR duplicado; únicamente falta que el propietario confirme en Render qué commit exacto está activo en producción.

---

## 2. Diagnóstico de la indisponibilidad de PostgreSQL

### Distinción estricta de estado

- **Causa confirmada:** **Ninguna para el incidente histórico.** En las dos comprobaciones de solo lectura del 2026-11-23 (19:23Z y 20:03Z), `GET /health/ready` devolvió **200 `ready`** con `database: up` y `radar: up`, y `GET /api/v1/catalogs` devolvió **200** (483 ms y 448 ms). No se ejecutó recuperación ni migración porque la base ya responde.
- **Arranque en frío observado:** En ambas rondas, la primera solicitud `GET /health/live` tardó **27 762 ms** (19:22:58Z) y **27 812 ms** (20:02:54Z), mientras las siguientes tardaron 123–791 ms. Esto es compatible con suspensión por inactividad de la instancia de la API en Render, pero no demuestra la causa del `database: down` previo.
- **Información que falta:** Acceso al panel y registros de Render (SHA desplegado, plan, región, logs del instante del 503), panel de Supabase (estado del proyecto, modo de conexión/pooler, versión, límites, eventos) y cadena `DATABASE_URL` real (el `.env` local apunta a `localhost:5432` y no representa producción). No se pueden verificar DNS, TCP, TLS ni pooler **API → PostgreSQL** desde fuera.

### Hipótesis y validación condicionada (sin asumir pausa de Supabase)

| Hipótesis | Cómo confirmarla | Acción exacta (requiere autorización) | Efecto esperado |
|---|---|---|---|
| Proyecto Supabase pausado por inactividad (plan Free pausa tras 7 días de baja actividad) | Estado explícito del proyecto y aviso en panel/correo de Supabase | Reanudar el mismo proyecto desde el panel de Supabase (**nunca** restaurar ni sobrescribir datos) | Restablece el mismo servidor y datos sin pérdida |
| Incompatibilidad IPv4/IPv6 o DNS | Código `ENOTFOUND`/`ENETUNREACH` en logs o en `diagnostico-conexiones.js` | Verificar en Supabase *Connect* el host: la conexión directa es IPv6 por defecto; el pooler Supavisor en **Session mode** (puerto 5432) soporta IPv4 y consultas preparadas con nombre | Restablece conectividad sin romper `feed.repository.ts` |
| Pooler en *Transaction mode* (puerto 6543) incompatible con consultas preparadas con nombre | Errores de *prepared statement* en logs de API + configuración en *Connect* | Cambiar `DATABASE_URL` al pooler en **Session mode** (o retirar `name` en repositorios con pruebas) | Elimina fallos intermitentes de consultas preparadas |
| Error TLS o credenciales | Código de certificado o SQLSTATE `28P01`/`28000` | Actualizar únicamente el secreto o CA afectado en Render sin desactivar validación TLS | Restablece autenticación segura |
| Pool agotado (`max: 20`, `connectionTimeoutMillis: 2000`) o incidencia del proveedor | Errores `53300`, saturación de conexiones o incidente en estado del proveedor | Ajustar tamaño del pool según límite del plan o esperar resolución del proveedor | Evita agotamiento sin ocultar lentitud con timeouts |

### Procedimiento de verificación para el operador (si recurre o para cierre histórico)

1. Revisar en **Render → API → Events/Logs/Environment** y **Supabase → Project → Status/Connect**: anotar SHA, `RADAR_MODE`, región, plan, modo del pooler y nombres de variables (nunca secretos ni URLs).
2. Desde el entorno de la API (heredando sus variables, nunca pegando secretos en el historial), ejecutar en modo solo lectura:
   ```bash
   node apps/api/scripts/diagnostico-conexiones.js
   ```
   Ejecuta resolución DNS, prueba TCP, `SELECT 1`/versión/TLS en PostgreSQL y `PING` en Redis con límite de diagnóstico de 8 s y códigos de error acotados (sin imprimir credenciales ni modificar datos).
3. **Prohibido durante la recuperación:** `npm run db:migrate:all`, *seeds*, recreación de tablas, restauraciones destructivas o pruebas de fallos sobre Supabase.
4. **Comprobaciones posteriores obligatorias:** `diagnostico-conexiones.js` con salida 0, `GET /health/ready` = 200 `ready` (`database: up`, `radar: up`), `GET /api/v1/catalogs` = 200, lectura autenticada de `/api/v1/radar/status`, `/api/v1/auth/profile-me` y `/api/v1/feed`.

---

## 3. Investigación de la sobrecarga del proxy y optimización respaldada por evidencia

### 3.1 Diagnóstico antes de optimizar (`577cca6`)

Antes de modificar código se inspeccionaron las rutas, middleware, cálculo de percentiles y telemetría de procesos en la ronda previa a optimizar ([benchmark-radar-etapa5-2026-11-23.json](evidencias/benchmark-radar-etapa5-2026-11-23.json), 2026-11-23T19:26:42Z, commit `577cca6`):

- **Cálculo y equivalencia verificados:** percentil de rango más cercano `ceil(p * n) - 1` sobre **todas** las solicitudes (incluidos errores), validación de cada respuesta contra `@social-unsch/contracts`, mismos datos sembrados en Redis por repetición, tokens RS256 equivalentes, solo un modo activo por vez y verificación de integridad en S2 (33 consensos + 1 voto residual).
- **Autenticación y validación:** no existe doble verificación RSA en proxy (API reenvía `Authorization`; solo Radar verifica la firma). No se eliminó ningún control de seguridad ni validación.
- **Reutilización TCP confirmada:** `api-proxy` registró exactamente **50 conexiones** (`undici:client:connected`) durante las 30 s de S1 (decenas de miles de solicitudes) — no creaba un socket por petición.
- **Cuello de botella demostrado por telemetría:** en las repeticiones 2 y 3 de S1 (`577cca6`), `api-proxy` consumía **83,0–86,8 % de un núcleo CPU**, **265 MB de RSS** y sufría un retraso del *event loop* **p95 de 38,0–39,8 ms** (109,1 ms en rep 1) a 1 052–1 171 rps, mientras que `radar` —que sí ejecuta verificación criptográfica RSA-2048 y *pipeline* de 7 `HGETALL` en Redis— solo tenía **16,6–17,0 ms** de retraso del *event loop* y **74,9–78,5 % CPU**.
- **Causa raíz en código (`apps/api/src/modules/radar/radar.proxy.ts`):**
  1. Uso de `fetch()` global (WHATWG Fetch sobre Undici): crea por cada petición objetos `URL`, `Request`, `Response`, `Headers`, `AbortController`/`AbortSignal`, `ReadableStream`, `await upstream.arrayBuffer()` y copia `Buffer.from(...)`.
  2. Uso de `res.status(upstream.status).send(payload)` en Express: fuerza detección de tipo y recálculo de ETag (hash criptográfico) sobre un cuerpo JSON ya generado por Radar.

### 3.2 Optimización aplicada (`d616f9b`)

- **Archivos:** [`apps/api/src/modules/radar/radar.proxy.ts`](../../apps/api/src/modules/radar/radar.proxy.ts), [`apps/api/src/modules/radar/radar.module.ts`](../../apps/api/src/modules/radar/radar.module.ts), [`apps/api/src/composition.ts`](../../apps/api/src/composition.ts), [`apps/api/tests/integration/radar.proxy.test.ts`](../../apps/api/tests/integration/radar.proxy.test.ts), [`scripts/lib/bench-telemetry.js`](../../scripts/lib/bench-telemetry.js).
- **Cambio:** sustituir el transporte por defecto del proxy por `http.request`/`https.request` nativo de Node.js con un `Agent` persistente (`keepAlive: true`, `keepAliveMsecs: 30000`, `maxSockets: 128`, `maxFreeSockets: 64`), construcción directa de la ruta destino precomputando host/puerto/esquema, transmisión directa (`upstreamRes.pipe(res)`) sin doble *buffering* ni recálculo de ETag, y cierre explícito del `Agent` (`close()`) en `composition.ts`. Se conserva `fetchImpl` inyectable para pruebas unitarias, la lista blanca exacta de cabeceras, intento único sin reintentos ni respaldo local, y los mismos timeouts y códigos 502/504.
- **No se aumentaron timeouts, no se cambió ningún contrato ni se redujo cobertura.**

### 3.3 Comparación reproducible local vs proxy

Comando reproducible (sobre aplicaciones compiladas, PostgreSQL 16 y Redis 7 reales desechables):
```powershell
$env:BENCH_OUT='docs/migracion/evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json'
npm run bench:radar
```

#### Evolución entre rondas (los resultados históricos NO se reescriben)

| Ronda | Fecha (UTC) | Commit | Entorno | S1 p95 Local (mediana) | S1 p95 Proxy (mediana) | Sobrecarga S1 | Costo abs. S1 | Veredicto umbral ≤ 20 % | Evidencia |
|---|---|---|---|---|---|---|---|---|---|
| Etapa 4 (histórica) | 2026-11-23 | `723e283` | Local Windows, Node 24.11.1, 6 cont. ajenos | 82,7 ms | 212,1 ms | +156,5 % | +129,4 ms | **NO CUMPLE** | [benchmark-radar-2026-11-23.json](evidencias/benchmark-radar-2026-11-23.json) |
| Etapa 5 pre-optimización (`fetch`) | 2026-11-23T19:26Z | `577cca6` | Local Windows, Node 24.11.1, 6 cont. ajenos | 60,66 ms | 90,66 ms | +49,5 % | +30,00 ms | **NO CUMPLE** | [benchmark-radar-etapa5-2026-11-23.json](evidencias/benchmark-radar-etapa5-2026-11-23.json) |
| Etapa 5 post-optimización (`http/https` nativo) | 2026-11-23T23:51Z | `d616f9b` | Local Windows, Node 24.11.1, 6 cont. ajenos | **157,45 ms** | **134,19 ms** | **-14,8 %** | **-23,27 ms** | **CUMPLE (en local)** | [benchmark-radar-etapa5-proxy-http-2026-11-23.json](evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json) |

#### Detalle por repetición · Ronda final (`d616f9b`, 3 repeticiones alternadas A-B-A-B-A-B)

Carga y duración: S1 = 50 usuarios simultáneos en bucle cerrado (10 s calentamiento + 30 s medición, 7 785–22 082 solicitudes/rep); S2 = 100 reportes válidos/min en bucle abierto (60 s); S3 = 20 GET/s en bucle abierto (10 s calentamiento + 30 s medición, 600 solicitudes/rep); arranque en frío medido aparte por proceso.

| Rep | Modo | Arranque frío (ms) | S1 p50 | S1 p95 | S1 p99 | S1 rps | Err/TO | Sobrecarga par S1 | S2 p95 (integridad) | S3 p50 / p95 | Recursos S1 (CPU med / RSS máx / EL p95 / conns) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Local | API 2 300 | 163,6 ms | 415,55 ms | 599,3 ms | 258 | 0 / 0 | — | 114,31 ms (33/33+1 OK) | 5,8 / 12,53 ms | api-local 42,8 % / 227 MB / 169,4 ms / 2 |
| 1 | Proxy | Radar 638 · API 659 | 129,4 ms | 290,42 ms | 414,4 ms | 336 | 0 / 0 | **-30,1 %** (-125,1 ms) | 15,45 ms (33/33+1 OK) | 5,6 / 7,91 ms | api-proxy 44,1 % / 121 MB / 32,8 ms / 51 · radar 53,0 % / 223 MB / 123,3 ms / 1 |
| 2 | Local | API 594 | 83,6 ms | 157,45 ms | 278,2 ms | 532 | 0 / 0 | — | 17,71 ms (33/33+1 OK) | 5,9 / 16,42 ms | api-local 78,0 % / 236 MB / 80,3 ms / 2 |
| 2 | Proxy | Radar 1 235 · API 1 745 | 64,3 ms | 134,19 ms | 198,3 ms | 735 | 0 / 0 | **-14,8 %** (-23,3 ms) | 12,58 ms (33/33+1 OK) | 7,7 / 12,08 ms | api-proxy 66,3 % / 121 MB / 22,6 ms / 51 · radar 87,6 % / 224 MB / 56,9 ms / 1 |
| 3 | Local | API 1 648 | 71,4 ms | 106,17 ms | 124,5 ms | 674 | 0 / 0 | — | 18,86 ms (33/33+1 OK) | 6,7 / 10,85 ms | api-local 97,7 % / 236 MB / 50,9 ms / 2 |
| 3 | Proxy | Radar 1 090 · API 1 628 | 74,4 ms | 108,52 ms | 158,1 ms | 646 | 0 / 0 | **+2,2 %** (+2,3 ms) | 13,59 ms (33/33+1 OK) | 7,4 / 11,35 ms | api-proxy 73,2 % / 123 MB / 20,3 ms / 51 · radar 92,3 % / 224 MB / 58,6 ms / 1 |

#### Lectura técnica honesta y limitaciones

1. **Impacto real de la optimización:** la RSS de `api-proxy` bajó a la mitad (**265 MB → 121–123 MB**), el retraso p95 de su *event loop* cayó a **20,3–32,8 ms** (antes 38–109 ms) y los 3 pares cumplieron `≤ 20 %` (`-30,1 %`, `-14,8 %`, `+2,2 %`), con 51 conexiones TCP reutilizadas en todo S1 y 0 errores/timeouts.
2. **Por qué el proxy igualó o superó a local en S1:** en un equipo multinúcleo (12 hilos), `api-local` satura un solo *event loop* ejecutando Express + RSA-2048 + Redis, mientras que al eliminar el cuello de `fetch()` en `api-proxy`, la carga se reparte en paralelo entre dos procesos (`api-proxy` y `radar`) sobre *loopback* (< 1 ms de red).
3. **Costo del salto sin saturación (S3, 20 GET/s):** la p50 subió de **5,9 ms a 7,4 ms** (+1,5 ms en *loopback*); la p95 fue 12,53 ms local frente a 11,35 ms proxy (-9,5 %) debido al ruido del equipo.
4. **Limitaciones que impiden extrapolar a producción:**
   - El equipo compartió CPU con **6 contenedores ajenos** (`buzon-comedor-unsch-*` y `agrocontrol-*`, incluido `agrocontrol-backup` en reinicio continuo) que no se detuvieron por instrucción, además del generador de carga en el mismo host (CPU 38,5–75,6 %). Esto explica la alta dispersión entre repeticiones (S1 local p95 varió de 106 ms a 416 ms).
   - *Loopback* no incluye latencia de red entre servicios de Render ni el recorte a 0,5 CPU de un plan Starter. En la plataforma real el salto HTTP añadirá varios milisegundos inevitables; por ello **sigue siendo obligatorio medir en staging/plataforma real antes de activar el proxy**, y si allí un umbral relativo del 20 % sobre latencias de pocos milisegundos volviera a fallar, deberá resolverse explícitamente con el propietario (por ejemplo, evaluando un criterio complementario de costo absoluto en ms) sin modificar la meta sin aprobación.

---

## 4. Criterios de aceptación y verificación final (`d616f9b`)

| Criterio / Umbral | Fecha | Commit | Entorno | Método / Carga | Resultado | Veredicto | Limitaciones / Evidencia |
|---|---|---|---|---|---|---|---|
| Cero fallos en suites estáticas, tipos, web y compilación | 2026-11-23 | `d616f9b` | Local Windows, Node 24.11.1 | `test:operations`, `check:boundaries`, `test:boundaries`, `typecheck`, `test:web`, `build:all` | 2/2 ops, 0 infracciones, 3/3 límites, 4/4 workspaces tipados, 14/14 web, 3/3 builds OK | **CUMPLE (local)** | Verificación CI en curso al publicar rama |
| Cobertura ≥ 90 % en API y Radar (4 ejes) | 2026-11-23 | `d616f9b` | Local Windows, Node 24.11.1 | `npm run test:coverage` | API: **96,37 / 92,21 / 97,10 / 97,08 %** (454/454, 27 suites); Radar: **98,65 / 91,47 / 97,72 / 99,31 %** (61/61, 11 suites) | **CUMPLE (local)** | Pruebas con dobles; no reemplaza pruebas reales |
| Pruebas reales API contra PostgreSQL y Redis | 2026-11-23 | `d616f9b` | Local Docker (PG 15 + Redis 7) | `npm run test:real` | **36 de 36** (5 suites), 0 fallos | **CUMPLE (local)** | Contenedores desechables locales |
| Pruebas E2E y aislamiento de fallos | 2026-11-23 | `d616f9b` | Local Docker (PG 16 + Redis 7, apps compiladas) | `npm run test:e2e` | **14 de 14**, 0 fallos (auth 30/30, 504 timeout, 502 Radar caído, Redis detenido/pausado, PG detenido, flujos ajenos intactos) | **CUMPLE (local)** | En Windows `SIGTERM` no prueba cierre ordenado; CI Linux sí lo valida |
| p95 < 500 ms con 50 usuarios (servicio activo) | 2026-11-23 | `d616f9b` | Local Windows, 6 cont. ajenos | `npm run bench:radar` S1 (3 reps × 30 s + 10 s cal.) | Mediana local **157,45 ms**, proxy **134,19 ms**; todas las reps < 500 ms, 0 errores | **CUMPLE (local)** | Alta dispersión; pendiente medir en staging/Render ([JSON](evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json)) |
| Sobrecarga p95 del proxy ≤ 20 % frente a local | 2026-11-23 | `d616f9b` | Local Windows, 6 cont. ajenos | `((p95_proxy - p95_local) / p95_local) × 100` en S1 | Mediana **-14,8 %** (-23,3 ms); pares: -30,1 %, -14,8 %, +2,2 % | **CUMPLE (local)** | Rondas previas (`723e283`, `577cca6`) siguen **NO CUMPLE**; loopback sin RTT real ([JSON](evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json)) |
| 100 reportes válidos/min sin errores ni pérdida de votos | 2026-11-23 | `d616f9b` | Local Windows, 6 cont. ajenos | `npm run bench:radar` S2 (60 s × 6 ejecuciones) | 0 errores en 600 reportes; 33/33 consensos + 1 voto residual en todas las reps; p95 18,86 ms local / 13,59 ms proxy | **CUMPLE (local)** | Pendiente validar con Upstash real ([JSON](evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json)) |
| 0 fallos atribuibles a Radar en flujos ajenos | 2026-11-23 | `d616f9b` | Local Docker | `npm run test:e2e` escenarios 9–11 | Catálogos, feed (lectura/escritura) y perfil 200 con Radar o Redis caídos | **CUMPLE (local)** | Pendiente observar en producción |
| Producción: PostgreSQL y API saludables en modo local | 2026-11-23 | SHA prod sin confirmar | Producción (Render + Supabase + Upstash) | `npm run ops:probe` (2 rondas GET, 19:23Z y 20:03Z) | `/health/ready` 200 `ready`, `database: up`, `radar: up`, catálogos 200, Radar sin token 401 | **OBSERVADO (puntual)** | Frío de 27,8 s; no prueba disponibilidad continua ni lectura autenticada ([ronda 2](evidencias/etapa5-production-2026-11-23-r2.json)) |

---

## 5. Diseño de despliegue compatible y análisis de costos

**Estado: PREPARADO.** No se han contratado planes ni modificado servicios.

### Condiciones verificadas en documentación oficial (2026-11-23)

- **Render** ([Free](https://render.com/docs/free), [Pricing](https://render.com/pricing), [Private Network](https://render.com/docs/private-network), [Health Checks](https://render.com/docs/health-checks)):
  - **Free ($0/mes):** ~0,1 CPU, 512 MB RAM, 750 horas gratuitas por workspace/mes, **suspensión tras 15 min sin tráfico**, arranque en frío de ~50–60 s (observado en nuestra API: 27,8–32,6 s y >70 s), **no puede recibir tráfico por red privada**.
  - **Starter ($7 USD/mes por servicio):** 0,5 CPU, 512 MB RAM, **siempre activo (sin suspensión por inactividad)**, admite red privada y *health checks* HTTP.
  - **Incompatibilidad demostrada:** un servicio Radar en plan Free tiene arranque en frío (27–60 s) superior al `RADAR_PROXY_TIMEOUT_MS` recomendado (5 s) e incluso al máximo configurable (30 s). **Queda prohibido usar cron o latidos artificiales periódicos para evitar la suspensión del plan Free.**
- **Upstash Redis** ([Pricing](https://upstash.com/pricing/redis)):
  - **Free ($0/mes):** 1 base, 250 MB, 500 000 comandos/mes, 10 GB ancho de banda, 10 000 cmd/s. (Nota: cada `GET /radar/status` usa un *pipeline* de 7 comandos; a 500k cmd/mes equivale a ~71k lecturas/mes si no hay otros usos).
  - **Pay-As-You-Go:** $0,20 / 100 000 comandos, $0,25 / GB almacenamiento, 200 GB ancho de banda gratis, con tope mensual configurable (*budget cap*). **Fixed:** desde $10/mes.
  - La red privada de Render conecta API ↔ Radar dentro de la misma región, pero **no elimina el RTT externo hacia Upstash**; por eso conviene confirmar la región exacta de API y Upstash desde los paneles y ubicar Radar en la misma región.
- **Supabase PostgreSQL** ([Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)):
  - **Free ($0/mes):** pausa automática tras 7 días de baja actividad; *Supavisor Session Mode* (puerto 5432) es compatible con IPv4 y con consultas preparadas con nombre.
  - **Pro ($25 USD/mes):** elimina pausa por inactividad y añade pooler dedicado PgBouncer.

### Opciones y presupuesto (pendiente aprobación del propietario)

| Opción | Costo público base (USD/mes) | Qué problema resuelve | Qué queda pendiente / riesgos |
|---|---|---|---|
| **A. Mantener Radar en modo local (actual)** | **+$0** | Evita 504 por arranque en frío sin aumentar costo; conserva resiliencia Redis ya en `main` | No hay aislamiento de proceso en producción; `apps/radar` queda probado y listo para activar cuando exista presupuesto |
| **B. Radar en Render Starter + API actual** | **+$7 / mes** (cómputo Radar) | Elimina la suspensión y arranque en frío de Radar; habilita red privada entrante a Radar | Si la API sigue en Free, la primera petición total al despertar la API seguirá tardando ~28–50 s; 0,5 CPU debe validarse en staging |
| **C. API y Radar en Render Starter** | **$14 / mes** de cómputo total (incremento según plan actual de API) | Elimina suspensión en ambos servicios; red privada bidireccional y latencia estable | No incluye eventuales costos de Upstash PAYG, Supabase Pro ($25/mes si se requiere cero pausa), impuestos o ancho de banda extra |

*Si el presupuesto no permite al menos la Opción B, la recomendación arquitectónica formal es mantener `RADAR_MODE=local` en producción y reevaluar al contar con presupuesto y resultados en staging.*

### Configuración candidata del servicio Radar en Render (sin secretos)

| Parámetro | Valor propuesto |
|---|---|
| Tipo de servicio | Render **Web Service** (permite *health checks* HTTP `/health/ready`; un *Private Service* solo ofrece check TCP) |
| Nombre / Repositorio / Raíz | `social-unsch-radar` / `pillacarodriguezuriel-a11y/social_unsch` / raíz del monorepo (vacío) |
| Rama y despliegue | `main` (commit aprobado con CI verde), **auto-deploy desactivado** inicialmente |
| Build Command | `npm ci --include=dev && npm run build:radar` |
| Start Command | `npm run start:radar` |
| Health Check Path | `/health/ready` (devuelve 503 si Redis falla) |
| Región y Plan | Misma región/workspace que la API; plan **Starter ($7/mes)** o superior sin suspensión |
| Runtime Node | `20.14.0` o `24.11.1` (ambos validados en matriz de CI) |
| Variables obligatorias (sin valores) | `NODE_ENV=production`, `PORT` (asignado por Render), `REDIS_URL` (`rediss://…`, **mismo almacén que la API**), `JWT_PUBLIC_KEY` (clave pública RSA en PEM), `ALLOWED_ORIGINS` (orígenes exactos de web/API), `SERVICE_NAME=social-unsch-radar` |
| Variables PROHIBIDAS en Radar | `DATABASE_URL`, `JWT_PRIVATE_KEY` |

Variables en la API para activar el proxy (solo tras Paso E y autorización explícita):
- Mantener `REDIS_URL` válida en la API aunque en modo proxy no abra conexión (garantiza reversión inmediata).
- `RADAR_MODE=proxy`
- `RADAR_PROXY_TARGET=http://<hostname-interno-render>:10000` (red privada si ambos están en la misma región y Radar es de pago) o `https://<dominio-confirmado>` (si se aprueba ruta HTTPS pública).
- `RADAR_PROXY_TIMEOUT_MS=5000` (no aumentar para disimular lentitud).

---

## 6. Procedimiento concreto de activación (A–G) y reversión

**Responsable de autorizar y ejecutar cambios en producción:** propietario `pillacarodriguezuriel-a11y` (o delegado nombrado explícitamente).
**Registro previo obligatorio antes de cada paso:** operador, fecha/hora UTC, número de PR, SHA de API y Radar, IDs de despliegue en Render, plan/región confirmados, configuración previa sin secretos y referencia de autorización.

| Fase | Acción exacta | Comprobaciones y puerta de aborto |
|---|---|---|
| **A. Línea base local** | Confirmar en paneles de Render y Supabase: API en `RADAR_MODE=local`, SHA desplegado con F-3/F-4, PostgreSQL y Redis saludables. Ejecutar `ops:probe` con `PROBE_TOKEN` seguro y verificar catálogos, perfil (`/api/v1/auth/profile-me`) y feed (`/api/v1/feed`). | **Abortar** si `/health/ready` != `ready`, si PostgreSQL falla, si falta token/cuenta de prueba o si el SHA en Render no está confirmado. |
| **B. Desplegar Radar sin tráfico** | Con autorización explícita de despliegue y gasto, crear/desplegar `social-unsch-radar` en Render al SHA aprobado **sin cambiar `RADAR_MODE=local` en la API**. | **Abortar** si región, plan sin suspensión, `REDIS_URL` compartida, `JWT_PUBLIC_KEY` o TLS no están verificados. |
| **C. Verificación de Radar aislado** | Comprobar `GET <RADAR>/health/ready` = 200 (`redis: up`), `GET <RADAR>/api/v1/radar/status` sin token = 401 `ERR_AUTH_TOKEN_MISSING`, con token válido = 200 cumpliendo contrato, y conectividad API → Radar desde el entorno de red destino con correlación `x-request-id`. | **Abortar** ante cualquier diferencia de contrato, rechazo de JWT válido o latencia/conectividad anómala. |
| **D. Pruebas controladas en staging / aislado** | Ejecutar suites (`verify`, `test:real`, `test:e2e`), benchmark comparable local vs proxy, ensayo de caída/recuperación y ensayo de cambio `proxy → local` en staging o infraestructura aislada. **Nunca** provocar caídas ni pruebas de carga en producción. | Si hay ensayos con escrituras en staging remoto: identificar URL, SHA, PostgreSQL desechable, Redis separado de producción, cuentas `qa-etapa5-*`, responsable y limpieza puntual por ID (nunca `FLUSHALL` remoto). |
| **E. Solicitud de autorización de activación** | Presentar al propietario: SHA, CI verde, resultados de staging/plataforma real, tabla de costos confirmados, verificación de flujos y plan de rollback. Solicitar autorización explícita para F y G. | **Abortar** si algún umbral vigente falla (incluyendo sobrecarga ≤ 20 % en staging/plataforma si aplica) o no hay autorización explícita. |
| **F. Activación controlada** | Operador configura `RADAR_MODE=proxy`, `RADAR_PROXY_TARGET` y `RADAR_PROXY_TIMEOUT_MS=5000` en la API, reinicia/redespliega y registra **T0 (UTC)**. Ejecuta `ops:probe` inmediato y verifica en logs el mismo `x-request-id` en API y Radar, además de catálogos, perfil y feed. | Solo lecturas remotas hasta autorizar explícitamente un voto de prueba (recordar: un voto en producción vive 900 s y afecta consenso). |
| **G. Reversión inmediata (Rollback)** | Ante cualquier condición de aborto: fijar `RADAR_MODE=local` en la API, confirmar que `REDIS_URL` sigue definida y válida, y reiniciar/redesplegar la API. **Nunca** vaciar `RADAR_PROXY_TARGET` dejando `RADAR_MODE=proxy` (la API no arrancaría). | Verificar `GET <API>/health/ready` = 200 `ready` (`database: up`, `radar: up`), lectura autenticada de `/api/v1/radar/status` = 200 (votos conservados en el mismo Redis), `/api/v1/catalogs`, `/api/v1/auth/profile-me` y `/api/v1/feed`. Conservar Radar sin tráfico para diagnóstico. |

### Reglas de consistencia y condiciones de rollback

- **Sin fallback automático ni reintentos de escritura:** `radar.proxy.ts` realiza un único intento y responde 502/504 controlado; volver a local es siempre explícito y requiere reinicio. Un 504 en `POST /radar/report` puede haber persistido el voto en Redis: no reintentar automáticamente.
- **Condiciones de rollback inmediato (propuestas para aprobar junto con la autorización F/G):**
  - Cualquier fallo de autenticación, corrupción de votos o discrepancia de contrato (acción inmediata, sin esperar ventanas).
  - Errores 502 o 504 sostenidos en `/api/v1/radar/*` durante dos ventanas consecutivas de 5 min.
  - `radar: down` en `/health/ready` de la API durante más de 5 min.
  - Degradación atribuible a Radar en flujos ajenos (catálogos, autenticación, feed, matchmaking, carpooling).
  - Si cae PostgreSQL, revertir Radar **no** resuelve la causa: abortar y ejecutar el diagnóstico de §2.

### Comandos de verificación operativa (PowerShell, sin secretos en argumentos)

```powershell
# Definir PROBE_TOKEN en una sesión segura del operador; nunca guardarlo en git ni imprimirlo.
$env:PROBE_API='https://social-unsch.onrender.com'
$env:PROBE_ENV='production-readonly'
$env:PROBE_DEPLOYED_COMMIT='<SHA confirmado en Render>'
$env:PROBE_OUT='docs/migracion/evidencias/prod-check-<fecha>.json'
npm run ops:probe
```

---

## 7. Plan de observación operativa de 14 días (desde T0 real)

**Estado: PREPARADO · NO INICIADO.** No se han ejecutado los 14 días de observación durante esta tarea. Al activarse en producción (`T0`), el operador copiará [etapa5-observation-template.json](evidencias/etapa5-observation-template.json) a una ubicación privada y registrará revisiones diarias (con hitos D1, D3, D7 y D14) en UTC, sin borrar ventanas anómalas ni reiniciar el contador.

### Matriz de señales, frecuencia, fuentes y ventanas

| Señal | Fuente | Frecuencia / ventana | Regla de interpretación |
|---|---|---|---|
| Disponibilidad API, Radar, PostgreSQL y Redis | `GET /health/ready` (JSON completo, **no** solo código 200 porque API devuelve `200 degraded` si cae Radar) | Cada 5 min **únicamente en plan sin suspensión aprobado**; agregado diario | Registrar `up`/`down`/`unknown` por servicio y porcentaje de muestras recibidas. Muestras faltantes = **SIN DATOS**, nunca disponibilidad |
| Latencia p50/p95/p99, 5xx y 504 por servicio y flujo | Logs JSON estructurados exportados diariamente de Render (`apps/api` y `apps/radar`) | Agregación offline en ventanas de 5 min y resumen diario con `npm run ops:summary` | Separar servicio, método y ruta (`GET /status` vs `POST /report`). No sumar percentiles entre servicios. Ventanas sin tráfico = **SIN DATOS** |
| Flujos de negocio reales | Lecturas autenticadas (`/radar/status`, `/catalogs`, `/auth/profile-me`, `/feed`) y tráfico/reportes reales o autorizados | Tras activación/rollback y 1 comprobación diaria | Una ruta de salud **no** demuestra que autenticación ni negocio funcionen. No guardar cuerpos ni datos personales |
| Reinicios y arranques en frío | Render → Events / Logs | Por evento, consolidado diario | Etiquetar la primera ventana tras reinicio/frío separada del régimen estable, sin excluirla de la disponibilidad |
| Consumo de recursos y conexiones | Paneles de Render (CPU/RSS), Upstash (comandos/conexiones) y Supabase (conexiones activas) | Exportación diaria (muestreo de 1 min si el plan lo provee) | Event loop en producción no está instrumentado en el código base: anotar ausencia de dato, nunca reusar cifras locales |
| Incidentes y MTTR | Plantilla privada (`incidentTemplate`) | Por incidente | Inicio, detección, flujos afectados, causa confirmada vs hipótesis, acción, recuperación verificada, SHA, operador y tiempo de recuperación |

### Recolección proporcionada y privacidad

```powershell
$env:LOG_INPUT='<ruta-local-export-jsonl>'
$env:OBS_SINCE='<inicio-UTC-ISO8601>'
$env:OBS_UNTIL='<fin-exclusivo-UTC-ISO8601>'
npm run ops:summary > '<resumen-diario>.json'
```

- `scripts/operation-summary.js` corre 100 % offline, filtra únicamente rutas y servicios permitidos, descarta cualquier campo con tokens/credenciales/cuerpos, informa líneas ignoradas y separa `errors5xx` de `timeouts504` (los timeouts vistos solo del lado del cliente requieren evidencia de cliente).
- Exportar logs diariamente a almacenamiento privado fuera del sistema de archivos efímero de Render y nunca subir logs crudos a GitHub.

### Umbrales operativos propuestos (pendientes de aprobación antes de ser obligatorios)

| Indicador operativo | Umbral propuesto | Nota |
|---|---|---|
| Disponibilidad por servicio | ≥ 99,5 % con cobertura de muestreo ≥ 95 % | Exige distinguir explícitamente `SIN_DATOS` |
| Tasa de errores 5xx por flujo | < 1 % en ventanas con ≥ 100 solicitudes | No superior a la línea base local |
| Tasa de timeouts 504 | < 0,1 % diario | Evaluado junto con incidentes |
| Recursos (CPU y RSS) | < 80 % sostenido durante 10 min | Según límites del plan contratado |
| Tiempo de recuperación (MTTR) | < 30 min desde detección | Confirmado en registro de incidentes |

*Estos SLO operativos son propuestas para aprobación del propietario; no sustituyen los criterios de aceptación de pruebas (`p95 < 500 ms`, `sobrecarga ≤ 20 %`, `100 reportes/min`).*

---

## 8. Matriz de estados y decisiones pendientes del propietario

| Elemento | PREPARADO | PROBADO LOCALMENTE | VERIFICADO EN CI | DESPLEGADO | OBSERVADO EN PRODUCCIÓN |
|---|---|---|---|---|---|
| Arreglos de resiliencia Redis (F-3 y F-4) | Sí | Sí | Sí (`main` `52e12dc`) | **No confirmado** (falta SHA en Render) | **No confirmado** |
| Optimización transporte nativo HTTP/HTTPS proxy (`d616f9b`) | Sí | Sí (454+61+14, 36 real, 14 E2E, bench 3 reps) | Pendiente al push final | **No** | **No** |
| Salud API / PostgreSQL / Redis en modo local | — | Sí | Sí | Sí (modo local) | Sí (2 rondas puntuales, 27,8 s frío) |
| Diagnóstico histórico de caída PostgreSQL | Sí (script y guía) | Sí | Sí | No aplica | **Causa sin confirmar** (sin logs/panel) |
| Despliegue de `apps/radar` en Render | Sí | Sí | Sí | **No** (404) | **No** |
| Activación `RADAR_MODE=proxy` y rollback | Sí (A–G) | Sí (E2E + bench) | Sí (E2E) | **No** | **No** |
| Observación operativa de 14 días | Sí (plantilla + scripts) | Sí (`test:operations`) | Sí | **No iniciada** | **No iniciada** |

### Decisiones agrupadas pendientes del usuario

1. **Paneles y diagnóstico histórico:** compartir estado, SHA activo de la API, plan/región de Render/Upstash/Supabase y logs sanitizados (o ejecutar `node apps/api/scripts/diagnostico-conexiones.js` en Render) para cerrar el diagnóstico de PostgreSQL y confirmar que F-3/F-4 están activos en producción.
2. **Revisión y fusión del PR de esta rama:** decidir si autoriza fusionar la optimización del proxy (`d616f9b`), la compilación local de Manrope y las utilidades/documentación de Etapa 5 a `main` (recordar que fusionar a `main` dispara el despliegue automático actual en Vercel/Render, manteniendo `RADAR_MODE=local`).
3. **Presupuesto y plan de despliegue:** elegir entre Opción A (**+$0**, mantener Radar local), Opción B (**+$7/mes** Radar Starter) u Opción C (**$14/mes** API + Radar Starter) y confirmar límites de Upstash/Supabase antes de contratar o crear el servicio.
4. **Staging y pruebas en plataforma real:** designar operador, entorno staging (con datos/Redis separados) y cuentas `qa-etapa5-*` para medir latencia real API → Radar → Upstash y ensayar activación/reversión antes de producción.
5. **Umbrales y autorización de activación (F/G):** aprobar los SLO operativos propuestos de §7, decidir cómo se evaluará el criterio de sobrecarga ≤ 20 % una vez medido con red real en staging y, solo con todos los gates en verde, autorizar explícitamente la activación del proxy y su ventana de observación de 14 días.

La extracción de Identidad, Comunidad o cualquier otro dominio queda **bloqueada** hasta resolver estos criterios y evaluar la experiencia operativa de Radar.

[← Estrategia de migración](README.md) · [← Índice](../README.md)
