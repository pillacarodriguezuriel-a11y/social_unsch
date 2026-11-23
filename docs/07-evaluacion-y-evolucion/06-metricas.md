# Métricas

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

| Workspace | Sentencias | Ramas | Funciones | Líneas | Pruebas |
|---|---|---|---|---|---|
| `@social-unsch/api` | 96,73 % | 92,96 % | 98,31 % | 96,84 % | 448 de 448, 26 suites |
| `@social-unsch/radar` | 98,63 % | 91,33 % | 97,67 % | 99,30 % | 59 de 59, 11 suites |
| `@social-unsch/web` | Sin medir | Sin medir | Sin medir | Sin medir | 14 de 14, 2 suites |

Son pruebas con dobles, ejecutadas en el equipo de desarrollo.

### Integración continua

| Job | Resultado | Ejecución |
|---|---|---|
| `verify` | Correcto | `39985651148` y `41060703064` en `main` |
| `test-real` | **Fallido** | `39985651148` y `41060703064` en `main` |

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
