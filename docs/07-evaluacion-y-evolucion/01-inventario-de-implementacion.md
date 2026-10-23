# Inventario de implementación

Estado de cada funcionalidad en el commit `8e56bfa`, capa por capa. Una funcionalidad solo se considera **Implementada** si sus cuatro columnas lo están: pantalla, API, datos y pruebas de servidor.

## Lectura rápida

| Funcionalidad | Pantalla | API | Datos | Pruebas de servidor | Estado global |
|---|---|---|---|---|---|
| Registro | Conectada | Sí | `users` | U, I, R | **Implementado** |
| Inicio de sesión | Conectada | Sí | `users` | U, I, R | **Implementado** |
| Aceptación de términos | Conectada | Sí, sin exigencia en servidor | `users` | U, I | **Parcial** |
| Catálogos | Conectada (registro y ajustes) | Sí | Tablas de catálogo | I, R | **Implementado** |
| Radar: consulta y reporte | Conectada | Sí | Redis | U, I, R | **Implementado** |
| Feed: lectura | Conectada, sin filtros | Sí, con filtros y paginación | `feed_posts` | U, I, R | **Parcial** |
| Feed: publicación | Conectada | Sí | `feed_posts` | U, I, R | **Implementado** |
| Feed: «me gusta» | Local | No | No | Ninguna | **Simulado** |
| Matchmaking: descubrir e interactuar | Conectada; habilidades generadas en el cliente | Sí | Tablas `matchmaking_*` | U, I, R | **Parcial** |
| Matchmaking: afinidad | Sin uso | Sí | `matchmaking_projects` | U, I | **Parcial** |
| Matchmaking: crear perfil o proyecto | No | No | Tablas existentes | Ninguna | **No implementado** |
| Matchmaking: chat tras coincidencia | Indicado como simulado en el componente | No; solo se genera un identificador | Columna `chat_channel_id` | Ninguna | **Simulado** |
| Carpooling: listar, solicitar, confirmar | Simulada con `localStorage` | Sí | Tablas `carpooling_*` | U, I, R | **Parcial** |
| Carpooling: publicar ruta | Simulada | No | Tabla existente | Ninguna | **Simulado** |
| Carpooling: rechazar solicitud | No | No | Estado previsto en el esquema | Ninguna | **No implementado** |
| Banco de archivos y créditos | Simulada | No | Tablas y disparador | Ninguna | **Simulado** |
| Moderación | Simulada | No | Tablas y disparador | Ninguna | **Simulado** |
| Marketplace | Simulada | No | No | Ninguna | **Simulado** |
| Empleo | Datos fijos | No | No | Ninguna | **Simulado** |
| Ajustes de perfil | Simulada | No | Columnas en `users` | Ninguna | **Simulado** |
| Alertas de campus persistentes | No | No | Tabla `campus_alerts` sin uso | Ninguna | **No implementado** |

Pruebas: U, unitarias; I, de rutas con dobles; R, contra servicios reales. Ninguna pantalla tiene pruebas automatizadas.

## Por capa

### Pantallas

| Pantalla | Archivo | Fuente de datos |
|---|---|---|
| Inicio de sesión | [login/page.tsx](../../apps/web/app/%28auth%29/login/page.tsx) | API |
| Registro | [register/page.tsx](../../apps/web/app/%28auth%29/register/page.tsx) | API |
| Inicio (feed) | [page.tsx](../../apps/web/app/%28dashboard%29/page.tsx) | API |
| Radar | [radar/page.tsx](../../apps/web/app/%28dashboard%29/radar/page.tsx) | API |
| Matchmaking | [matchmaking/page.tsx](../../apps/web/app/%28dashboard%29/matchmaking/page.tsx) | API y datos generados |
| Carpooling | [carpooling/page.tsx](../../apps/web/app/%28dashboard%29/carpooling/page.tsx) | `localStorage` |
| Banco de archivos | [wiki-files/page.tsx](../../apps/web/app/%28dashboard%29/wiki-files/page.tsx) | `localStorage` |
| Moderación | [moderation/page.tsx](../../apps/web/app/%28dashboard%29/moderation/page.tsx) | `localStorage` |
| Marketplace | [marketplace/page.tsx](../../apps/web/app/%28dashboard%29/marketplace/page.tsx) | `localStorage` |
| Empleo | [jobs/page.tsx](../../apps/web/app/%28dashboard%29/jobs/page.tsx) | Lista fija en el código |
| Ajustes | [settings/page.tsx](../../apps/web/app/%28dashboard%29/settings/page.tsx) | `localStorage`; catálogo desde la API |

Cinco pantallas trabajan contra la API y seis no.

### API

16 rutas en 7 módulos; el frontend consume 10. La lista completa está en [Contratos e integraciones](../02-arquitectura-de-software/07-contratos-e-integraciones.md).

Rutas implementadas que ninguna pantalla usa: `GET /auth/profile-me`, `GET /catalogs/schools`, `POST /matchmaking/score` y las tres de carpooling.

### Datos

| Grupo de tablas | Usado por la API |
|---|---|
| `users`, catálogos, `feed_posts`, `matchmaking_*`, `carpooling_*` | Sí |
| `academic_files`, `file_downloads`, `wiki_credits_log` | No |
| `moderation_reports`, `moderation_audit_log` | No |
| `campus_alerts` | No |

De 16 tablas de negocio, 6 no las usa ningún módulo.

### Pruebas

| Suite | Archivos | Alcance |
|---|---|---|
| Unitarias | 12 en [tests/unit](../../apps/api/tests/unit) | Servicios, repositorios y validadores con la base, Redis y JWT sustituidos |
| De rutas | 7 en [tests/integration](../../apps/api/tests/integration) | Rutas HTTP con las mismas sustituciones. A pesar del nombre del directorio, no integran con servicios reales |
| Reales | 5 en [tests/real](../../apps/api/tests/real) | PostgreSQL y Redis en contenedores desechables |
| Frontend | Ninguna | — |
| Extremo a extremo | Ninguna | — |

Los resultados de ejecución, con su fecha y procedencia, están en el [informe de documentación](../INFORME_DOCUMENTACION.md).

## Operación

| Capacidad | Estado | Evidencia |
|---|---|---|
| Migraciones versionadas con registro y bloqueo | Implementado | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) |
| Carga de catálogos que conserva identificadores | Implementado | [load_catalogs.ts](../../apps/api/src/database/migrations/load_catalogs.ts) |
| Seed de demostración restringido a local | Implementado | [load_demo_seed.ts](../../apps/api/src/database/migrations/load_demo_seed.ts) |
| Diagnóstico de conexiones de solo lectura | Implementado | [diagnostico-conexiones.js](../../apps/api/scripts/diagnostico-conexiones.js) |
| Reversión de migraciones | No implementado | — |
| Integración continua | No implementado | — |
| Rutas de salud | Implementado en la etapa 3 | [health.routes.ts](../../apps/api/src/health/health.routes.ts) |
| Validación de configuración al arrancar | Implementado en la etapa 3 | [env.ts](../../apps/api/src/config/env.ts) |
| Comprobación de límites entre unidades | Implementado en la etapa 3 | [check-boundaries.js](../../scripts/check-boundaries.js) |
| Métricas, alertas | No implementado | — |
| Respaldo de la base | No implementado en el repositorio | — |
| Archivos de despliegue versionados | No implementado | — |

## Evolución arquitectónica

| Etapa | Estado | Evidencia |
|---|---|---|
| 1. Línea base y recuperación de infraestructura | Línea base ejecutada. Recuperación: la base responde a la API; Redis sin verificar | [ETAPA_01_LINEA_BASE.md](../migracion/ETAPA_01_LINEA_BASE.md), [Mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md) |
| 2. Estabilización | Ejecutada en el código e integrada en `main`. Aplicación completa en la base remota: parcialmente verificada | [ETAPA_02_ESTABILIZACION.md](../migracion/ETAPA_02_ESTABILIZACION.md) |
| 3 a 8 | Propuestas; sin ejecución | [Plan de migración](03-plan-de-migracion.md) |

## Balance

- El núcleo que funciona de extremo a extremo es pequeño y sólido: identidad, radar y publicación en el feed.
- Carpooling es el caso con mayor desajuste: tiene la API más probada del sistema y una pantalla que no la usa.
- Banco de archivos y moderación tienen el modelo de datos resuelto y nada más.
- La arquitectura sigue siendo un monolito modular; la migración a servicios no ha empezado.

[← Índice](../README.md)
