# Métricas

Separa lo que se propone medir de lo que se ha medido. Una meta no es un resultado, y una cifra solo cuenta si mide el sistema real.

## Métricas propuestas

| Criterio | Meta propuesta | Verificación | Resultado |
|---|---|---|---|
| Latencia p95 de `GET /radar/status` | Menor de 500 ms con 50 usuarios simultáneos | Prueba de carga contra un entorno desplegado | PENDIENTE DE MEDICIÓN |
| Latencia p95 por proxy frente a local | No peor en más de un 20 % | Misma carga en ambos modos | PENDIENTE DE MEDICIÓN |
| Tasa de errores 5xx | No superior a la previa a la activación | Registros JSON durante la observación | PENDIENTE DE MEDICIÓN |
| Disponibilidad | Por definir | Comprobación externa periódica de `/health/ready` | PENDIENTE DE MEDICIÓN |
| Duración de despliegue | Por definir | Historial de Render y Vercel | PENDIENTE DE MEDICIÓN |
| Tiempo de recuperación ante base pausada | Menor de 30 min | Simulacro cronometrado | PENDIENTE DE MEDICIÓN |
| Tiempo de reversión de Radar | Por definir | Ensayo de `RADAR_MODE=local` | PENDIENTE DE MEDICIÓN |
| Arranque en frío de Radar | Menor que `RADAR_PROXY_TIMEOUT_MS` | `curl -w` tras la suspensión | PENDIENTE DE MEDICIÓN |
| Consumo de recursos | Dentro del plan contratado | Panel de la plataforma | PENDIENTE DE MEDICIÓN |
| Costo mensual | Dentro del presupuesto, sin definir | Facturación | PENDIENTE DE MEDICIÓN |
| Cobertura | 90 % o más en API y Radar | `npm run test:coverage` | Ver abajo |
| Fallos de integración | 0 en CI antes de fusionar | GitHub Actions | Ver abajo |

## Resultados medidos

Medidos el 2026-10-30 sobre `f480728`, salvo donde se indique.

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
| `verify` | Correcto | `39985651148`, 2026-10-23 |
| `test-real` | **Fallido** | `39985651148`, 2026-10-23 |

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

## Cifras que no deben citarse como resultados

| Cifra | Origen | Por qué no vale como medición |
|---|---|---|
| Sobrecarga del proxy de +0,27 ms a +0,82 ms en p95 y tiempos de arranque | Tabla de [ETAPA_04 §9](../migracion/ETAPA_04_EXTRACCION_RADAR.md#9-mediciones-de-rendimiento-reproducibles) | [benchmark-radar.js](../../scripts/benchmark-radar.js) simula ambos servidores con `http.createServer` y un almacén en memoria. No ejecuta `apps/api`, `apps/radar`, el proxy real ni Redis |
| Arranque en Docker de 500 a 1500 ms | Misma tabla | No hay Dockerfile en el repositorio ni medición registrada |
| Arranque en frío de Radar de unos 50 s | Misma tabla | Estimación; el servicio no está desplegado. Lo observado es de la API: 32,6 s |
| Incremento de red de 5 a 15 ms | [ADR-008](../06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md) | Estimación, sin medición |
| 100 % operativa del resto de la API con Radar caído | ADR-008 | Probado con dobles; sin medir en producción |

Ver también: [Escenarios de calidad](../01-analisis-del-sistema/08-escenarios-de-calidad.md) · [Estrategia de pruebas](05-estrategia-de-pruebas.md) · [Estado actual y evidencias](07-estado-actual-y-evidencias.md)

[← Índice](../README.md)
