# Inventario técnico y de configuración

Estado del código consolidado en la rama `chore/etapa-1-linea-base` (ver [ETAPA_01_LINEA_BASE.md](ETAPA_01_LINEA_BASE.md)). Todo lo que sigue se obtuvo inspeccionando el código fuente y las configuraciones del repositorio.

## 0. Actualización de la etapa 3 (2026-10-23)

Las secciones 1, 4, 5 y 6 describen el estado de la etapa 1. Desde la etapa 3 ([informe](ETAPA_03_PREPARACION_SEPARACION.md)):

| Aspecto | Estado |
|---|---|
| Estructura | npm workspaces: `apps/web` (Next.js), `apps/api` (Express), `packages/contracts` (contratos Zod de Radar); un único `package-lock.json` |
| Versiones declaradas | `engines`: Node `^20.14.0 \|\| ^22.11.0 \|\| ^24.0.0`, npm `>=10.8.0`; `npm ci` verificado con npm 10.8.2, 11.6.2 y 11.9.0 |
| Dependencias | Cada aplicación declara las suyas; `cookie-parser` retirado; `ts-node` declarado en la API |
| TypeScript | `apps/api/tsconfig.json` (salida `dist/`), `apps/api/tsconfig.jest.json`, `apps/web/tsconfig.json`, `apps/web/tsconfig.jest.json`, `packages/contracts/tsconfig.json` |
| Pruebas | `apps/api`: unitarias, de rutas, de contrato y reales; `apps/web`: lógica de `app/lib`; `scripts/check-boundaries.test.js` |
| Plantillas de entorno | `apps/api/.env.example` y `apps/web/.env.example` |
| Variables nuevas | `RADAR_MODE`, `RADAR_PROXY_TARGET`, `RADAR_PROXY_TIMEOUT_MS` (API) |
| Salud | `GET /health/live`, `GET /health/ready` |
| Scripts | Ver [ETAPA_03 §8](ETAPA_03_PREPARACION_SEPARACION.md#8-comandos) |

## 1. Estructura

Un único paquete npm (`social-unsch-backend`) contiene frontend y backend; no hay workspaces configurados.

| Ruta | Contenido |
|---|---|
| `app/` | Frontend Next.js 14 (App Router). Grupos `(auth)`: login, register. `(dashboard)`: inicio/feed, radar, matchmaking, carpooling, wiki-files, marketplace, jobs, moderation, settings |
| `components/ui/` | 19 componentes de interfaz en React |
| `app/lib/api.ts` | Cliente Axios centralizado; token Bearer gestionado en `localStorage` |
| `src/app.ts`, `src/server.ts` | Aplicación Express y punto de entrada del servidor |
| `src/modules/<dominio>/` | Arquitectura `routes → controller → service → repository` para auth, users, radar, feed, matchmaking, carpooling |
| `src/config/` | `database.ts` (pg Pool), `redis.ts` (ioredis), `jwt.ts` (RS256), `generate_keys.ts` |
| `src/database/migrations/` | Definiciones SQL y ejecutores de migración TypeScript |
| `tests/` | Suite Jest: `unit/` (12 suites) e `integration/` (6 suites). **100% basada en dobles de prueba** |
| `scripts/` | `dev-all.js`; `diagnostico-conexiones.js` (script de diagnóstico seguro de solo lectura) |

No existen: `AGENTS.md`, `next.config.*`, configuración de ESLint, `vercel.json`, `render.yaml`, `Dockerfile`, `.nvmrc`, campo `engines`, flujos de CI remotos.

## 2. Rutas registradas en el backend

Prefijo `/api/v1`. Todas salvo registro e inicio de sesión exigen `Authorization: Bearer <token>` con firma RS256.

| Módulo | Rutas | Almacén |
|---|---|---|
| auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/profile-me` | PostgreSQL |
| users | `PATCH /users/accept-terms` | PostgreSQL |
| radar | `GET /radar/status`, `POST /radar/report` | Redis (script Lua con agregación atómica y TTL de 900 s) |
| feed | `GET /feed`, `POST /feed` | PostgreSQL |
| matchmaking | `POST /matchmaking/score`, `GET /matchmaking/profiles`, `POST /matchmaking/interact` | PostgreSQL |
| carpooling | `GET /carpooling`, `POST /carpooling/:route_id/request`, `PATCH /carpooling/:route_id/confirm` | PostgreSQL |

No hay ruta de salud dedicada (`GET /` responde 404). El paquete `cookie-parser` está declarado como dependencia pero no se utiliza en el pipeline de middlewares.

## 3. Funcionalidad: conectada, simulada o ausente

| Área | Estado en el frontend |
|---|---|
| Registro, inicio de sesión, aceptación de términos | Conectada a la API |
| Radar del campus | Conectada a la API (requiere token autenticado) |
| Feed | Lectura y publicación conectadas; los "likes" son locales en el cliente |
| Matchmaking | Perfiles e interacción conectados; habilidades calculadas en cliente; `POST /matchmaking/score` no se invoca desde el frontend |
| Carpooling | **Simulada**: rutas en `localStorage` y reservas simuladas con `setTimeout`. La API de backend existe pero el frontend no la consume |
| Wiki-banco de archivos y créditos | **Simulada** en `localStorage`. Existen tablas y triggers en PostgreSQL, pero no hay módulo API expuesto |
| Moderación | **Simulada** en `localStorage`. Existen tablas y triggers en PostgreSQL, pero no hay módulo API expuesto |
| Marketplace, bolsa de trabajo (jobs) | **Simuladas** en cliente; sin API ni tablas asociadas |
| Ajustes de perfil, privacidad y notificaciones | Solo persistencia en `localStorage` |

## 4. Scripts de `package.json`

| Script | Comando | Propósito |
|---|---|---|
| `build` | `tsc --project tsconfig.backend.json` | Compila backend a `dist/` |
| `build:frontend` | `next build` | Compila frontend Next.js y valida tipos estáticos |
| `start` | `node dist/server.js` | Ejecuta el servidor compilado en producción |
| `dev`, `dev:backend` | `ts-node-dev --project tsconfig.backend.json … src/server.ts` | Servidor backend en desarrollo |
| `dev:frontend` | `next dev -p 3001` | Servidor frontend Next.js en puerto 3001 |
| `dev:all` | `node scripts/dev-all.js` | Ejecuta frontend y backend en paralelo |
| `db:migrate:all` | `ts-node --project tsconfig.backend.json src/database/migrations/migrate_all.ts` | Ejecuta el pipeline de migraciones (incluye seeds) |
| `test` | `jest` | Ejecuta las 18 suites de pruebas con `ts-jest` |
| `test:watch` | `jest --watch` | Ejecuta pruebas en modo observador |
| `test:coverage` | `jest --coverage` | Genera reporte de cobertura (exige >= 90%) |

## 5. Versiones y dependencias

| Componente | Declarada | Instalada / Resuelta |
|---|---|---|
| Node.js | README: "v18+"; sin `engines` | Local: 24.11.1 (npm 11.6.2). Render: pendiente confirmar |
| next | ^14.2.4 | 14.2.35 |
| react / react-dom | ^18.3.1 | 18.3.1 |
| express | ^4.19.2 | 4.22.2 |
| typescript | ^5.5.2 | 5.9.3 |
| pg | ^8.12.0 | 8.22.0 |
| ioredis | ^5.11.1 | 5.11.1 |
| jsonwebtoken | ^9.0.2 | 9.0.3 |
| bcrypt | ^5.1.1 | 5.1.1 (módulo binario) |
| zod | ^3.23.8 | 3.25.76 |
| tailwindcss | ^4.3.2 | 4.3.2 |
| jest / ts-jest | ^30.4.2 / ^29.4.11 | 30.4.2 / 29.4.11 |
| supertest | ^7.2.2 | 7.2.2 |

El archivo `package-lock.json` ha sido sincronizado y validado mediante instalación limpia con `npm ci`.

## 6. Configuración de TypeScript y pruebas

- `tsconfig.json`: Frontend Next.js, `noEmit`, `moduleResolution: node`, incluye `src/**`.
- `tsconfig.backend.json`: Backend Node16 (`module: Node16`, `moduleResolution: node16`), `rootDir: src`, `outDir: dist`.
- `tsconfig.jest.json`: Extiende `tsconfig.backend.json`, configurado con `"rootDir": "."` para dar cabida tanto a `src/` como a `tests/` sin generar conflictos TS6059 y manteniendo `strict: true`.
- `jest.config.ts`: Entorno node, umbral estricto de cobertura del 90 % en las 4 dimensiones (ramas, funciones, líneas, declaraciones).
- **Inventario de pruebas y aislamiento**:
  - `tests/unit/`: 12 suites (250 pruebas). Todas emplean dobles de prueba (`jest.fn()` y mocks de servicios/repositorios).
  - `tests/integration/`: 6 suites (113 pruebas). Ejecutadas con `supertest` sobre `app.ts`. Todos los recursos de infraestructura (`src/config/database`, `src/config/redis`, `src/config/jwt`, `bcrypt`) están sustituidos con `jest.mock`.
  - **Servicios reales**: Ninguna prueba del arnés Jest se conecta a un servidor PostgreSQL o Redis real.

## 7. Contrato y comportamiento del Radar en Redis

El Campus Radar implementa un script Lua atómico para votación comunitaria:
- **Nodos soportados**: `comedor`, `rectorado`, `campus_alert`, `biblioteca_floor_1` a `biblioteca_floor_4`.
- **Ventana y consenso**:
  - Requiere un umbral de **3 votos independientes** coincidentes en el mismo estado para mutar el Hash oficial.
  - El usuario que ya reportó un estado en la ventana actual es detectado mediante `SISMEMBER` y su voto duplicado es descartado.
  - Al alcanzarse los 3 votos, el estado oficial se guarda en el Hash (`radar:<nodo>:status`) con campos `status`, `report_count` y `last_updated`.
  - Se aplica un `TTL` de **900 segundos** (15 minutos) tanto a los conjuntos de votantes como al Hash consolidado.

## 8. Base de datos y riesgos identificados para la Etapa 2

- `run_seed.ts` ejecuta `seed.sql`, que inserta 4 cuentas demo y restablece sus contraseñas mediante `ON CONFLICT (email) DO UPDATE`.
- `run_canonical_migration.ts` ejecuta `DELETE FROM professional_schools; DELETE FROM faculties;` destruyendo datos previos si existieran.
- Los ejecutores de migración devuelven código de salida 0 aun cuando ocurra un fallo de consulta.
- Estos puntos constituyen el backlog prioritario para la Etapa 2.
