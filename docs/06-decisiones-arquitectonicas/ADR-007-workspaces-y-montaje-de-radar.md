# ADR-007 · Separación en npm workspaces y montaje reemplazable de Radar

| Campo | Valor |
|---|---|
| Estado | **Aceptado para la etapa 3**; implementado en la rama `refactor/etapa-3-preparacion-separacion`, pendiente de revisión y fusión |
| Tipo | Decisión de implementación de la [ADR-003](ADR-003-migracion-gradual-por-dominios.md) |
| Fecha de documentación | 2026-10-23 |
| Línea base | Commit `60db1eb` de `main` |
| Aprobación | Sin aprobación documentada fuera de la solicitud de la etapa 3 |

## Problema observado

En `60db1eb`:

- Frontend y backend comparten un único `package.json`, un `tsconfig.json` que incluye `src/**` y una sola configuración de Jest. `next build` lee el mismo `.env` que contiene los secretos del backend.
- `app.ts` construye la aplicación al importarse y monta todos los módulos de forma fija; el radar crea su conexión a Redis al importar `config/redis.ts`.
- Las reglas del radar (nodos y estados válidos) están escritas solo dentro de `RadarService`; el frontend las repite a mano.
- No hay ruta de salud ni validación de configuración al arrancar.

Con esa forma, extraer el radar en la etapa 4 exigiría tocar a la vez el empaquetado, el arranque, la configuración y el frontend.

## Decisión

1. **npm workspaces** con tres paquetes: `apps/web` (Next.js), `apps/api` (Express) y `packages/contracts` (contratos de intercambio). Un único `package-lock.json` en la raíz.
2. **`packages/contracts` solo con contratos de Radar y el formato de error**, definidos con Zod: una sola definición produce la validación en tiempo de ejecución y los tipos. Sin conexiones, secretos ni persistencia.
3. **Composición explícita en la API**: `createApp(dependencias)` construye la aplicación; `server.ts` valida la configuración, crea las conexiones, arranca y las cierra al apagarse.
4. **Radar se monta como una unidad reemplazable** en `/api/v1/radar`: por defecto, el módulo local con su cliente Redis inyectado; opcionalmente, un **proxy desactivado por defecto** hacia un destino fijado en la configuración del servidor.
5. **Comprobaciones de salud** `GET /health/live` y `GET /health/ready`.
6. **Comprobación de límites** con un script propio sin dependencias.

El backend sigue siendo **una única aplicación desplegable**. Un monorepo no implica microservicios.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Mantener un solo paquete y separar solo los `tsconfig` | No separa dependencias ni archivos de entorno; el frontend seguiría pudiendo importar código del servidor |
| Nx o Turborepo | Añaden una herramienta y un modelo de tareas sin necesidad demostrada para tres paquetes |
| Repositorios separados | Rompe el historial común y complica cambios coordinados en el contrato |
| Contratos en OpenAPI escrito a mano | Sería una segunda definición junto a la validación del código, con riesgo de contradicción |
| Puerta de enlace como servicio aparte ya en la etapa 3 | Añade un despliegue sin beneficio hasta que exista un servicio de radar |
| Reescribir todos los módulos con arquitectura hexagonal | Fuera del alcance; solo el radar necesita prepararse ahora |

## Impacto

| Área | Impacto |
|---|---|
| Imports | El código no cambia de rutas relativas internas. El frontend importa de `@social-unsch/contracts` solo con `import type`. El radar importa sus valores permitidos desde el contrato |
| Scripts | Los comandos de la raíz se conservan (`dev:frontend`, `dev:backend`, `build`, `build:frontend`, `start`, `test`, `test:coverage`, `test:real`, `db:*`) y delegan en cada workspace |
| Pruebas | Las pruebas del backend pasan a `apps/api/tests`; el frontend tiene su propia configuración de Jest para `lib/` |
| Despliegues | Vercel necesita **Root Directory = `apps/web`**. Render puede seguir usando la raíz con los mismos comandos, si instala dependencias de desarrollo y arranca con `npm start`. Ver [ETAPA_03](../migracion/ETAPA_03_PREPARACION_SEPARACION.md) |
| Configuración | Plantillas separadas `apps/api/.env.example` y `apps/web/.env.example`; la API sigue leyendo un `.env` en la raíz como respaldo de compatibilidad |

## Compatibilidad

- Rutas, cuerpos, códigos de estado y códigos de error de `/api/v1` sin cambios.
- `RADAR_MODE=local` por defecto: sin configuración nueva, el radar funciona como antes.
- Los comandos de la raíz se mantienen; `npm run build` sigue construyendo el backend.

## Reversión

- **Reversión completa:** revertir los commits de la etapa (`git revert`) o no fusionar la rama. No hay cambios de datos ni de esquema.
- **Reversión del enrutamiento:** `RADAR_MODE=local` devuelve el radar al módulo local sin redesplegar código.
- Si Vercel ya se configuró con `apps/web`, debe volver a la raíz al revertir.

## Condiciones para reconsiderarla

- Que el número de paquetes o el tiempo de construcción justifique una herramienta de monorepo.
- Que el frontend necesite validar en tiempo de ejecución con los esquemas del contrato.
- Que la etapa 4 opte por una puerta de enlace dedicada en lugar del proxy en la API.

[← Índice de ADR](README.md) · [← Índice](../README.md)
