# Métricas

> Medición comparable e instrumentación actuales: [Operación de Radar](../migracion/ETAPA_05_OPERACION_RADAR.md) (§3, §4 y §7). En la ronda post-optimización (`d616f9b`, transporte HTTP/HTTPS nativo con *keep-alive* y *streaming*), los cinco criterios locales cumplieron (mediana S1 p95: 157,45 ms local vs 134,19 ms proxy, sobrecarga **-14,8 %**; pares -30,1 %, -14,8 % y +2,2 %; 0 errores en S1/S2/S3; integridad 33/33+1 en S2), con alta dispersión por equipo compartido y sin RTT de red real ([benchmark-radar-etapa5-proxy-http-2026-11-23.json](../migracion/evidencias/benchmark-radar-etapa5-proxy-http-2026-11-23.json)). Los resultados históricos previos (`723e283` y `577cca6`) se conservan como **NO CUMPLE** y no se consideran aprobados retrospectivamente. La validación en staging/plataforma real sigue pendiente.

Separa lo que se propone medir de lo que se ha medido. Una meta no es un resultado, y una cifra solo cuenta si mide el sistema real.

## Métricas propuestas

| Criterio | Meta propuesta | Verificación | Resultado |
|---|---|---|---|
| Latencia p95 de `GET /radar/status` | Menor de 500 ms con 50 usuarios simultáneos | Prueba de carga | **Cumple en local**: 82,7 ms local y 212,1 ms proxy, mediana de 3 repeticiones ([cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md#7-benchmark-real)). En la plataforma: PENDIENTE DE MEDICIÓN |
| Latencia p95 por proxy frente a local | No peor en más de un 20 % | Misma carga en ambos modos | **NO CUMPLE en local**: +156 % con 50 usuarios; +11 ms (+319 %) a 20 solicitudes/s ([cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md#7-benchmark-real)) |
| 100 reportes válidos por minuto | Cero errores inesperados y p95 menor de 500 ms | Carga a tasa fija | **Cumple en local**: 0 errores en 600 reportes; p95 18,2 ms local y 17,1 ms proxy |
| Tasa de errores 5xx | No superior a la previa a la activación | Registros JSON durante la observación | PENDIENTE DE MEDICIÓN |
| Disponibilidad | Por definir | Comprobación externa periódica de `/health/ready` | PENDIENTE DE MEDICIÓN |
| Duración de despliegue | Por definir | Historial de Render y Vercel | PENDIENTE DE MEDICIÓN |
| Tiempo de recuperación ante base pausada | Menor de 30 min | Simulacro cronometrado | PENDIENTE DE MEDICIÓN |
| Tiempo de reversión de Radar | Por definir | Ensayo de `RADAR_MODE=local` | PENDIENTE DE MEDICIÓN |
| Arranque en frío de Radar | Menor que `RADAR_PROXY_TIMEOUT_MS` | `curl -w` tras la suspensión | Proceso local: 450 ms hasta `/health/ready`. En Render: PENDIENTE DE MEDICIÓN; el de la API superó los 30 s |
| Consumo de recursos | Dentro del plan contratado | Panel de la plataforma | PENDIENTE DE MEDICIÓN |
| Costo mensual | Dentro del presupuesto, sin definir | Facturación | PENDIENTE DE MEDICIÓN |
| Cobertura | 90 % o más en API y Radar | `npm run test:coverage` | Ver abajo |
| Fallos de integración | 0 en CI antes de fusionar | GitHub Actions | Ver abajo |

## Resultados medidos

Medidos el 2026-10-30 sobre `b763885`, salvo donde se indique.

### Cobertura

Medida el 2026-11-25 sobre `452f9d6` más los cambios de la etapa 8 (`npm run verify`, salida 0). Umbral exigido: 90 % en los cuatro ejes de cada workspace instrumentado.

| Workspace | Sentencias | Ramas | Funciones | Líneas | Pruebas |
|---|---|---|---|---|---|
| `@social-unsch/feed-domain` | 100 % | 100 % | 100 % | 100 % | 66 de 66, 4 suites |
| `@social-unsch/api` | 96,05 % | 90,32 % | 95,54 % | 97,47 % | 435 de 435, 27 suites |
| `@social-unsch/radar` | 98,65 % | 91,47 % | 97,72 % | 99,31 % | 61 de 61, 11 suites |
| `@social-unsch/feed` | 98,85 % | 92,95 % | 95,83 % | 99,40 % | 54 de 54, 4 suites |
| `@social-unsch/web` | Sin medir | Sin medir | Sin medir | Sin medir | 14 de 14, 2 suites |

**630 pruebas en total.** Son pruebas con dobles, ejecutadas en el equipo de desarrollo; la cobertura no sustituye a las pruebas con infraestructura real. El eje más ajustado es el de ramas de la API (90,32 %): un cambio que añada condicionales sin probarlos rompe la puerta de cobertura.

La cifra de la API bajó respecto a la medición anterior porque las pruebas del servicio y del repositorio de Feed se trasladaron a `@social-unsch/feed-domain`, donde ahora vive la única implementación. No es una pérdida de cobertura: el mismo código se mide en otro workspace, al 100 %.

### Integración continua

CI ejecuta cuatro jobs en matriz Node 20.14.0 y 24.11.1: `verify`, `test-real`, `e2e-radar` y `e2e-feed` ([ci.yml](../../.github/workflows/ci.yml)).

| Job | Resultado | Ejecución |
|---|---|---|
| `verify` | Correcto | Verde en `main` `452f9d6` ([45492869658](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45492869658)) y en `codex/etapa-8-cierre-migracion` |
| `test-real` | **Fallido en `main` `452f9d6`**; corregido en etapa 8 | Falló en `45492869658` por faltar `@social-unsch/feed-domain` en `jest.real.config.ts`/`ci.yml`; 36/36 en local sobre `f93847c` |
| `e2e-radar` | Correcto | Verde en `main` `452f9d6` (`45492869658`) y 14/14 en local sobre `f93847c` |
| `e2e-feed` | **Fallido en `main` `452f9d6`**; corregido y ampliado en etapa 8 | Falló en `45492869658`; 16/16 en local sobre `f93847c` (incluye permisos mínimos PG y matriz `proxy/proxy`) |

Para los benchmarks exploratorios de Feed (`benchmark-feed-etapa8-2026-11-25.json` y corrida limpia `f93847c`), ver [Cierre de la migración §6](../migracion/ETAPA_08_CIERRE_MIGRACION.md#6-rendimiento-y-costos).

### Producción

Comprobación externa de solo lectura, 2026-10-30. Una sola muestra por ruta: es una observación, no una estadística.

| Medición | Resultado |
|---|---|
| `GET /health/live`, primera solicitud tras inactividad | 200 en 32,6 s |
| `GET /health/ready` | 200 en 1,14 s; `database: up`, `radar: up` |
| `GET /api/v1/catalogs/schools` | 200 en 0,28 s |
| `GET /api/v1/radar/status` sin token | 401 en 0,24 s |
| `GET /login` en Vercel | 200 en 0,94 s |
| `GET` del servicio Radar previsto | 404: no desplegado |

### Rendimiento de Radar (2026-11-23, local)

Benchmark con las aplicaciones reales, commit `723e283`, 3 repeticiones por modo alternadas. Datos completos: [benchmark-radar-2026-11-23.json](../migracion/evidencias/benchmark-radar-2026-11-23.json). Válido solo para este equipo, esta carga y esta duración.

| Escenario | Modo | p50 | p95 | p99 | Rendimiento | Errores |
|---|---|---|---|---|---|---|
| S1: 50 usuarios simultáneos, 30 s | Local | 36,8 ms | 82,7 ms | 141,2 ms | 1 203 rps | 0 |
| S1 | Proxy | 80,0 ms | 212,1 ms | 328,8 ms | 520 rps | 0 |
| S2: 100 reportes/min, 60 s | Local | — | 18,2 ms | — | 100 por repetición | 0 |
| S2 | Proxy | — | 17,1 ms | — | 100 por repetición | 0 |
| S3: 20 solicitudes/s, 30 s | Local | 2,3 ms | 3,5 ms | — | 600 por repetición | 0 |
| S3 | Proxy | 4,5 ms | 14,5 ms | — | 600 por repetición | 0 |

Medianas de las tres repeticiones. La dispersión entre repeticiones fue alta: el p95 local de S1 osciló entre 46 y 182 ms. Ver las limitaciones en el informe.

## Cifras que no deben citarse como resultados

| Cifra | Origen | Por qué no vale como medición |
|---|---|---|
| Sobrecarga del proxy de +0,27 ms a +0,82 ms en p95 y tiempos de arranque (2026-10-23) | Tabla de [ETAPA_04 §9](../migracion/ETAPA_04_EXTRACCION_RADAR.md#9-mediciones-de-rendimiento-reproducibles) | La versión de entonces de `benchmark-radar.js` simulaba ambos servidores con `http.createServer` y un almacén en memoria. No ejecuta `apps/api`, `apps/radar`, el proxy real ni Redis |
| Arranque en Docker de 500 a 1500 ms | Misma tabla | No hay Dockerfile en el repositorio ni medición registrada |
| Arranque en frío de Radar de unos 50 s | Misma tabla | Estimación; el servicio no está desplegado. Lo observado es de la API: 32,6 s |
| Incremento de red de 5 a 15 ms | [ADR-008](../06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md) | Estimación, sin medición |
| 100 % operativa del resto de la API con Radar caído | ADR-008 | Probado con dobles; sin medir en producción |

Ver también: [Escenarios de calidad](../01-analisis-de-sistema/08-escenarios-atributos-calidad.md) · [Estrategia de pruebas](05-estrategia-de-pruebas.md) · [Estado actual y evidencias](07-estado-actual-y-evidencias.md)

[← Índice](../README.md)
