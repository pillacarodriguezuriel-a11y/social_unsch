# Resultados de verificación — Etapa 1

Ejecutado el 2026-10-10 en Windows 11, Node 24.11.1, npm 11.6.2, Docker 29.0.1, sobre la rama `chore/etapa-1-linea-base`.

## 1. Instalación reproducible

| Comprobación | Comando | Resultado | Evidencia / Detalle |
|---|---|---|---|
| Sincronización de lockfile | `npm install --package-lock-only` | Correcto | Sincronizó `package-lock.json` incorporando paquetes opcionales WASM (`@emnapi/wasi-threads`, `@emnapi/core`, `@emnapi/runtime`) sin alterar versiones mayores |
| Simulación rápida | `npm ci --dry-run` | Correcto | Resuelve el árbol completo sin advertencias ni dependencias faltantes |
| **Instalación real en copia limpia** | `npm ci` (directorio temporal aislado) | **Correcto** (código 0) | Instalación completa desde cero en carpeta temporal sin secretos (`test_ci_*`). Instaló 585 paquetes en 1m 0s sin errores |
| Integridad del árbol | `npm ls jest ts-jest` | Correcto | `jest@30.4.2` y `ts-jest@29.4.11` correctamente vinculados |

## 2. Compilación, tipado estricto y lint

| Comprobación | Comando | Resultado | Detalle |
|---|---|---|---|
| Compilación backend | `npm run build` | Correcto | `tsc --project tsconfig.backend.json` genera `dist/` sin advertencias |
| Compilación frontend | `npm run build:frontend` | Correcto | `next build` genera 14 rutas estáticas prerenderizadas |
| Tipado frontend y compartido | `npx tsc --noEmit -p tsconfig.json` | Correcto | 0 errores de tipado |
| **Tipado de suite de pruebas** | `npx tsc --noEmit -p tsconfig.jest.json` | **Correcto** | El error TS6059 (`rootDir`) se resolvió configurando `"rootDir": "."` en `tsconfig.jest.json`, manteniendo tipado estricto (`strict: true`) y abarcando `src/` y `tests/` |
| Lint | — | No configurado | A implementar en fases posteriores |

## 3. Pruebas y cobertura

| Tipo | Comando | Resultado | Uso de servicios |
|---|---|---|---|
| Unitarias | `npm test -- tests/unit` | 12 suites, 250 pruebas pasadas | **Dobles de prueba** (`jest.fn()`, repositorios simulados) |
| Integración HTTP | `npm test -- tests/integration` | 6 suites, 113 pruebas pasadas | **Dobles de prueba** (`jest.mock` en pg pool, ioredis, jwt, bcrypt) |
| Total suite Jest | `npm test` | **18 suites, 363 pruebas pasadas** | 100% aisladas del entorno exterior |
| Cobertura | `npm run test:coverage` | **Statements 95.25%, Branches 92.85%, Funcs 98.41%, Lines 95.38%** | Supera el umbral mínimo obligatorio del 90% |

> [!NOTE]
> Las 363 pruebas de la suite Jest validan controladores, validadores, servicios y middlewares de seguridad contra dobles. **No interactúan con PostgreSQL ni Redis reales.**

## 4. Verificación del Radar contra Redis desechable y puertos libres

Se desplegó un contenedor efímero aislado de Redis para verificar el contrato real del código sin enviar escrituras a producción ni alterar otros entornos:

- **Contenedor temporal**: `social_unsch_disposable_redis_etapa1` (`redis:7-alpine`).
- **Puerto asignado**: `127.0.0.1:56379` (puerto libre verificado previamente).
- **Puerto HTTP de prueba**: `43000` (puerto libre para el backend local, evitando colisión con `127.0.0.1:3000` ocupado por otro proyecto).

### Resultados de la prueba del Radar:
1. `PING` contra `127.0.0.1:56379`: Responde `PONG`.
2. Estado inicial (`RadarService.getStatus()`): `{ status: 'indefinido', is_definite: false }`.
3. Voto 1 (`node: 'comedor'`, `status: 'fluid'`, `user: 'usr_001'`):
   - Respuesta: `{ updated: false, votesCount: 1, message: 'Reporte registrado, esperando más confirmaciones' }`.
4. Voto 2 (`node: 'comedor'`, `status: 'fluid'`, `user: 'usr_002'`):
   - Respuesta: `{ updated: false, votesCount: 2, message: 'Reporte registrado, esperando más confirmaciones' }`.
5. Voto duplicado (`user: 'usr_002'` repite voto):
   - Respuesta: `{ updated: false, votesCount: 0, message: 'Ya reportaste este estado en la ventana actual' }`.
6. Voto 3 de confirmación (`user: 'usr_003'` vota `'fluid'` alcanzando umbral de 3):
   - Respuesta: `{ updated: true, votesCount: 3, message: 'Estado actualizado' }`.
7. Lectura consolidada (`getStatus()`):
   - Comedor: `{ status: 'fluid', is_definite: true }`.
8. Inspección directa en Redis (`HGETALL radar:comedor:status` y `TTL`):
   - Hash almacenado: `{ status: 'fluid', report_count: '3', last_updated: '<timestamp>' }`.
   - **TTL comprobado**: **900 segundos** (15 minutos), conforme a la especificación de diseño.
9. Segundo nodo (`campus_alert`, `'class_suspended'`):
   - Consenso de 3 votos alcanzado, estado final `{ status: 'class_suspended', is_definite: true }` y `TTL` = 900 s.
10. Verificación por endpoints HTTP en puerto `43000` con claves RSA efímeras:
   - `POST /api/v1/radar/report` respondió HTTP 200 en los tres envíos progresivos.
   - `GET /api/v1/radar/status` respondió HTTP 200 con el estado consolidado.

### Limpieza de contenedores:
- El contenedor efímero `social_unsch_disposable_redis_etapa1` fue detenido y eliminado al concluir la prueba.
- **Recursos ajenos preservados**: Los contenedores de otros proyectos (`buzon-comedor-unsch-app-1`, `buzon-comedor-unsch-proxy-1`, `buzon-comedor-unsch-db-1`, `agrocontrol-*`) y los contenedores previos de este repositorio (`social_unsch_postgres`, `social_unsch_redis`) continúan intactos en su estado original sin alterar sus políticas de reinicio.

## 5. Estado de infraestructura externa y pendientes del propietario

1. **Supabase**:
   - La captura oficial del panel aportada por el propietario indica que la reanudación del proyecto está habilitada hasta el **31 de agosto de 2027**.
   - No se debe calcular dicho plazo de gracia desde la fecha de despliegue.
   - Acción requerida: Reactivar el proyecto desde el panel y obtener la cadena del pooler.
2. **Render**:
   - El servicio responde HTTP 401 en `/api/v1/radar/status` (está en ejecución).
   - `POST /api/v1/auth/login` devuelve HTTP 500.
   - **Hipótesis**: La inaccesibilidad de PostgreSQL (Supabase pausado) es la causa más probable del error 500, pero se mantiene formalmente como una hipótesis hasta revisar los *runtime logs* en el panel de Render.
3. **Upstash (Redis)**:
   - Requiere comprobación visual directa en el panel para verificar si puede restaurarse o si es necesario crear una base nueva con esquema seguro `rediss://`.
   - No debe asumirse que todo el contenido es descartable antes de revisar si existían llaves previas.

## 6. Próximos pasos técnicos (Etapa 2)

Las tareas locales prioritarias a ejecutar en la Etapa 2 son:
1. Desacoplar migraciones de esquema respecto a seeds destructivos.
2. Hacer idempotentes las inserciones en tablas canónicas (`faculties`, `schools`).
3. Propagar códigos de salida `process.exit(1)` ante fallos en ejecutores de migración.
4. Auditar la asignación de roles en `/auth/register`.
5. Alinear consultas de repositorio con el esquema de base de datos.
6. Diseñar arnés de pruebas con PostgreSQL y Redis reales para flujos críticos.
