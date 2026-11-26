# Configuración y entornos

Variables de entorno y entornos del sistema. Solo se documentan nombres, propósito, consumidor, obligatoriedad y sensibilidad. **Este documento no contiene valores reales**; los ejemplos son ficticios.

Desde la etapa 3 hay dos plantillas: [apps/api/.env.example](../../apps/api/.env.example) para la API y [apps/web/.env.example](../../apps/web/.env.example) para la aplicación web. El archivo `.env` está excluido de Git ([.gitignore](../../.gitignore)).

## Variables de entorno

| Variable | Propósito | Componente consumidor | Obligatoria | Sensibilidad |
|---|---|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | API ([database.ts](../../apps/api/src/config/database.ts)) y herramientas de migración | Sí | **Secreta** |
| `REDIS_URL` | Cadena de conexión a Redis | API ([redis.ts](../../apps/api/src/config/redis.ts)) | Sí en producción; en local tiene valor por defecto | **Secreta** |
| `JWT_PRIVATE_KEY` | Clave privada RSA para firmar tokens | API ([jwt.ts](../../apps/api/src/config/jwt.ts)) | Sí | **Secreta, crítica** |
| `JWT_PUBLIC_KEY` | Clave pública RSA para verificar tokens | API ([jwt.ts](../../apps/api/src/config/jwt.ts)) | Sí | No secreta; debe corresponder a la privada |
| `ALLOWED_ORIGINS` | Orígenes permitidos por CORS, separados por comas | API ([app.ts](../../apps/api/src/app.ts)) | Sí en producción | Pública |
| `NODE_ENV` | Modo de ejecución; fuera de `production` se permiten orígenes locales | API ([app.ts](../../apps/api/src/app.ts)), seed de demostración | Recomendada | Pública |
| `PORT` | Puerto de escucha | API ([server.ts](../../apps/api/src/server.ts)) | No; la plataforma suele definirla | Pública |
| `APP_PORT` | Puerto de respaldo si no hay `PORT` | API ([server.ts](../../apps/api/src/server.ts)) | No; por defecto 3000 | Pública |
| `NEXT_PUBLIC_API_URL` | URL base de la API | Aplicación web ([api.ts](../../apps/web/app/lib/api.ts)) | Sí al compilar para producción | **Pública**: queda incrustada en el código del navegador |
| `ALLOW_DEMO_SEED` | Confirmación explícita para cargar datos de demostración | Seed ([load_demo_seed.ts](../../apps/api/src/database/migrations/load_demo_seed.ts)) | No | Pública; no debe definirse en producción |
| `RADAR_MODE` | `local` (por defecto) o `proxy` | API ([env.ts](../../apps/api/src/config/env.ts)) | No | Pública |
| `RADAR_PROXY_TARGET` | Origen del servicio de radar en modo proxy | API | Solo si `RADAR_MODE=proxy` | Interna; sin credenciales |
| `RADAR_PROXY_TIMEOUT_MS` | Límite de tiempo del proxy (100 a 30000; 5000 por defecto) | API | No | Pública |

Qué ocurre si falta una variable obligatoria:

| Variable ausente | Comportamiento |
|---|---|
| `DATABASE_URL` | La API arranca con una advertencia; las rutas con base de datos fallan |
| `REDIS_URL` | La API intenta conectar a `127.0.0.1:6379`; en producción el radar falla |
| `JWT_PRIVATE_KEY` | La API arranca; el inicio de sesión falla |
| `JWT_PUBLIC_KEY` | La API arranca; todas las rutas protegidas responden 401 |
| `ALLOWED_ORIGINS` | Solo se permite `https://social.unsch.edu.pe` y, fuera de producción, orígenes locales; el frontend desplegado quedaría bloqueado |
| `NEXT_PUBLIC_API_URL` | El frontend llama a `http://localhost:3000/api/v1` |

Desde la etapa 3 la API valida su configuración al arrancar ([env.ts](../../apps/api/src/config/env.ts)): sin `DATABASE_URL`, `JWT_PRIVATE_KEY` o `JWT_PUBLIC_KEY` (y sin `ALLOWED_ORIGINS` en producción) termina con código 1 y enumera las variables afectadas, sin mostrar valores. La tabla anterior describe el comportamiento previo a esa etapa. La ausencia de `REDIS_URL` en producción solo genera un aviso: el radar queda no disponible y el resto de la API funciona.

## Formato de las variables

Ejemplos con valores ficticios:

```bash
# PostgreSQL local, según docker-compose.yml
DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/social_unsch

# PostgreSQL gestionado con TLS: reemplazar todos los marcadores
DATABASE_URL=postgresql://<USUARIO>:<CONTRASENA>@<HOST>:<PUERTO>/<BASE>?sslmode=require

# Redis local
REDIS_URL=redis://127.0.0.1:6379

# Redis gestionado con TLS: el esquema rediss:// activa el cifrado
REDIS_URL=rediss://<USUARIO>:<CONTRASENA>@<HOST>:<PUERTO>

# Orígenes: sin espacios
ALLOWED_ORIGINS=https://frontend.ejemplo.com,https://otro.ejemplo.com

# Claves: PEM en una sola línea, con los saltos de línea escritos como \n
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n<CONTENIDO>\n-----END PUBLIC KEY-----\n"
```

Detalles que causan errores frecuentes:

- **TLS de PostgreSQL.** El pool no define una opción `ssl`; el cifrado depende de que la cadena incluya el parámetro correspondiente.
- **TLS de Redis.** Depende únicamente del esquema `rediss://`.
- **Claves JWT.** El código convierte los `\n` escritos en saltos de línea reales. Un par de claves nuevo se genera con [generate_keys.ts](../../apps/api/src/config/generate_keys.ts). Cambiar las claves invalida todas las sesiones activas.
- **Orígenes CORS.** La comparación es exacta: una barra final o un espacio hacen que el origen no coincida.

## Dónde se define cada variable

| Variable | Desarrollo local | Plataforma de la API | Plataforma del frontend |
|---|---|---|---|
| `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ALLOWED_ORIGINS`, `NODE_ENV`, `RADAR_*` | `apps/api/.env` (o `.env` de la raíz, por compatibilidad) | Sí | No |
| `PORT` | No | La define la plataforma | No |
| `NEXT_PUBLIC_API_URL` | Opcional en `apps/web/.env.local` | No | Sí |
| `ALLOW_DEMO_SEED` | Solo al cargar el seed | **Nunca** | No |

Qué variables están realmente definidas en cada plataforma está pendiente de verificación.

Desde la etapa 3, `next build` se ejecuta en `apps/web` y solo lee los archivos de entorno de ese directorio: los secretos de la API ya no están a su alcance.

## Entornos

| Entorno | Existe | Datos | Cómo se levanta |
|---|---|---|---|
| Desarrollo local | Sí | PostgreSQL y Redis de [docker-compose.yml](../../docker-compose.yml) | `docker compose up -d` y los comandos de desarrollo |
| Pruebas reales | Sí, efímero | Contenedores desechables en los puertos 55432 y 56379, creados y eliminados por la propia suite | `npm run test:real` ([test-environment.ts](../../apps/api/tests/real/helpers/test-environment.ts)) |
| Vista previa | Solo frontend | La vista previa del frontend apunta a la API que tenga configurada; no hay API ni base de vista previa | Automático al subir una rama |
| Preproducción (*staging*) | **No** | — | — |
| Producción | Sí | Servicios gestionados | Ver [Mapa de despliegue](01-mapa-de-despliegue.md) |

La ausencia de preproducción significa que un cambio de esquema o de backend se prueba en local y después directamente en producción. La suite de pruebas reales protege su base rechazando cualquier conexión que no apunte a su instancia de prueba.

## Reglas para el manejo de secretos

- Ningún secreto se guarda en el repositorio, en la documentación ni en mensajes de commit.
- Las cadenas de conexión no se imprimen completas; el script [diagnostico-conexiones.js](../../apps/api/scripts/diagnostico-conexiones.js) muestra solo protocolo, servidor y puerto.
- La clave privada JWT existe en un único lugar: donde se emiten tokens.
- En la arquitectura propuesta, los servicios que solo verifican tokens reciben únicamente la clave pública.

## Servicio Radar

Variables de `apps/radar` ([plantilla](../../apps/radar/.env.example), [env.ts](../../apps/radar/src/config/env.ts)). **Estado:** código en `main`, sin desplegar.

| Variable | Propósito | Obligatoria | Sensibilidad |
|---|---|---|---|
| `JWT_PUBLIC_KEY` | Verificar tokens | Sí; el proceso no arranca sin ella | Pública |
| `REDIS_URL` | Conexión a Redis, `rediss://` activa TLS | Recomendada; en producción sin ella solo avisa e intenta conectar a local | **Secreta** |
| `ALLOWED_ORIGINS` | Orígenes CORS | Recomendada; en producción sin ella solo avisa y usa valores por defecto con `localhost` | Pública |
| `PORT`, `APP_PORT` | Puerto; 4001 por defecto | No | Pública |
| `NODE_ENV`, `SERVICE_NAME` | Entorno y nombre en los registros | No | Pública |

Radar nunca debe recibir `JWT_PRIVATE_KEY` ni `DATABASE_URL`.

Al usar `RADAR_MODE=proxy` en la API, `RADAR_PROXY_TARGET` es obligatoria: si falta, la API no arranca. En ese modo la API no abre Redis, pero conviene conservar `REDIS_URL` para poder revertir.

## Servicio Feed

Variables de `apps/feed` ([env.ts](../../apps/feed/src/config/env.ts)). **Estado:** código en `main`, sin desplegar.

| Variable | Propósito | Obligatoria | Sensibilidad |
|---|---|---|---|
| `JWT_PUBLIC_KEY` | Verificar tokens RS256 | Sí; el proceso no arranca sin ella | Pública |
| `DATABASE_URL` | Conexión a PostgreSQL, esquema `postgres://` o `postgresql://` | Sí; el proceso no arranca sin ella | **Secreta** |
| `ALLOWED_ORIGINS` | Orígenes CORS | Recomendada; en producción sin ella solo avisa | Pública |
| `PORT`, `APP_PORT` | Puerto; 4002 por defecto | No | Pública |
| `NODE_ENV`, `SERVICE_NAME` | Entorno y nombre en los registros | No | Pública |

**Feed nunca debe recibir `JWT_PRIVATE_KEY` ni `REDIS_URL`.** Solo verifica firmas; no emite tokens ni usa Redis. Un fallo de configuración se informa sin imprimir el valor de ninguna variable.

Al usar `FEED_MODE=proxy` en la API, `FEED_PROXY_TARGET` es obligatoria: si falta, la API no arranca. A diferencia de Radar, en modo proxy la API **sigue necesitando `DATABASE_URL`** porque el resto de sus módulos la usan; conservarla es también lo que permite revertir a `FEED_MODE=local` sin redespliegue.

### Variables de la API para el modo proxy de Feed

| Variable | Valor | Nota |
|---|---|---|
| `FEED_MODE` | `proxy` | `local` es el valor por defecto y el activo hoy en producción |
| `FEED_PROXY_TARGET` | `http://<host-interno>:10000` o `https://<dominio-confirmado>` | Sin credenciales, sin query ni fragmento; la API rechaza el arranque si no cumple |
| `FEED_PROXY_TIMEOUT_MS` | `5000` (defecto); rango 100–30000 | No aumentar para disimular lentitud |

### Configuración candidata del servicio en Render (sin secretos)

No se ha creado ni modificado ningún servicio. Esta es la propuesta a aprobar:

| Parámetro | Valor propuesto |
|---|---|
| Tipo de servicio | **Web Service** (permite *health check* HTTP `/health/ready`) |
| Nombre / Repositorio / Raíz | `social-unsch-feed` / `pillacarodriguezuriel-a11y/social_unsch` / raíz del monorepo |
| Rama y despliegue | `main` en un commit con CI verde, **auto-deploy desactivado** inicialmente |
| Build Command | `npm ci --include=dev && npm run build:feed` |
| Start Command | `npm run start:feed` |
| Health Check Path | `/health/ready` (devuelve 503 si PostgreSQL falla) |
| Región y Plan | Misma región que la API y Supabase; plan **sin suspensión por inactividad** |
| Runtime Node | `20.14.0` o `24.11.1` (ambos validados en la matriz de CI) |

**Incompatibilidad conocida:** un plan con suspensión por inactividad tiene arranque en frío de decenas de segundos, superior al máximo configurable de `FEED_PROXY_TIMEOUT_MS` (30 s). Activar el proxy contra un servicio así produce 504 sistemáticos. Queda prohibido usar cron o latidos artificiales para evitar la suspensión: eso elude el límite del proveedor y falsea la medición del arranque en frío.

**Antes de desplegar** hay que confirmar en Supabase el límite de conexiones del plan y el modo del pooler: el presupuesto conjunto pasa a 30 conexiones y el pooler en *Transaction mode* es incompatible con las consultas preparadas con nombre que usa el repositorio ([detalle](../02-arquitectura-software/06-datos-y-propiedad-por-dominio.md#presupuesto-total-de-conexiones)).

[← Índice](../README.md)
