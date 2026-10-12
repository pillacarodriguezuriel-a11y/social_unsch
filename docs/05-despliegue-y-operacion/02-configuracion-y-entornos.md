# Configuración y entornos

Variables de entorno y entornos del sistema. Solo se documentan nombres, propósito, consumidor, obligatoriedad y sensibilidad. **Este documento no contiene valores reales**; los ejemplos son ficticios.

La plantilla para crear un archivo local es [.env.example](../../.env.example). El archivo `.env` está excluido de Git ([.gitignore](../../.gitignore)).

## Variables de entorno

| Variable | Propósito | Componente consumidor | Obligatoria | Sensibilidad |
|---|---|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | API ([database.ts](../../src/config/database.ts)) y herramientas de migración | Sí | **Secreta** |
| `REDIS_URL` | Cadena de conexión a Redis | API ([redis.ts](../../src/config/redis.ts)) | Sí en producción; en local tiene valor por defecto | **Secreta** |
| `JWT_PRIVATE_KEY` | Clave privada RSA para firmar tokens | API ([jwt.ts](../../src/config/jwt.ts)) | Sí | **Secreta, crítica** |
| `JWT_PUBLIC_KEY` | Clave pública RSA para verificar tokens | API ([jwt.ts](../../src/config/jwt.ts)) | Sí | No secreta; debe corresponder a la privada |
| `ALLOWED_ORIGINS` | Orígenes permitidos por CORS, separados por comas | API ([app.ts](../../src/app.ts)) | Sí en producción | Pública |
| `NODE_ENV` | Modo de ejecución; fuera de `production` se permiten orígenes locales | API ([app.ts](../../src/app.ts)), seed de demostración | Recomendada | Pública |
| `PORT` | Puerto de escucha | API ([server.ts](../../src/server.ts)) | No; la plataforma suele definirla | Pública |
| `APP_PORT` | Puerto de respaldo si no hay `PORT` | API ([server.ts](../../src/server.ts)) | No; por defecto 3000 | Pública |
| `NEXT_PUBLIC_API_URL` | URL base de la API | Aplicación web ([api.ts](../../app/lib/api.ts)) | Sí al compilar para producción | **Pública**: queda incrustada en el código del navegador |
| `ALLOW_DEMO_SEED` | Confirmación explícita para cargar datos de demostración | Seed ([load_demo_seed.ts](../../src/database/migrations/load_demo_seed.ts)) | No | Pública; no debe definirse en producción |

Qué ocurre si falta una variable obligatoria:

| Variable ausente | Comportamiento |
|---|---|
| `DATABASE_URL` | La API arranca con una advertencia; las rutas con base de datos fallan |
| `REDIS_URL` | La API intenta conectar a `127.0.0.1:6379`; en producción el radar falla |
| `JWT_PRIVATE_KEY` | La API arranca; el inicio de sesión falla |
| `JWT_PUBLIC_KEY` | La API arranca; todas las rutas protegidas responden 401 |
| `ALLOWED_ORIGINS` | Solo se permite `https://social.unsch.edu.pe` y, fuera de producción, orígenes locales; el frontend desplegado quedaría bloqueado |
| `NEXT_PUBLIC_API_URL` | El frontend llama a `http://localhost:3000/api/v1` |

La API no valida su configuración al arrancar: no se detiene si falta una variable. Los fallos aparecen después, en cada solicitud.

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
- **Claves JWT.** El código convierte los `\n` escritos en saltos de línea reales. Un par de claves nuevo se genera con [generate_keys.ts](../../src/config/generate_keys.ts). Cambiar las claves invalida todas las sesiones activas.
- **Orígenes CORS.** La comparación es exacta: una barra final o un espacio hacen que el origen no coincida.

## Dónde se define cada variable

| Variable | Desarrollo local | Plataforma de la API | Plataforma del frontend |
|---|---|---|---|
| `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ALLOWED_ORIGINS`, `NODE_ENV` | `.env` | Sí | No |
| `PORT` | No | La define la plataforma | No |
| `NEXT_PUBLIC_API_URL` | Opcional en `.env` | No | Sí |
| `ALLOW_DEMO_SEED` | Solo al cargar el seed | **Nunca** | No |

Qué variables están realmente definidas en cada plataforma está pendiente de verificación.

Observación: en local, `next build` lee el mismo `.env` que la API. Solo las variables con prefijo `NEXT_PUBLIC_` llegan al navegador, pero compartir el archivo facilita errores. Separar los archivos de entorno forma parte de la etapa 3 propuesta.

## Entornos

| Entorno | Existe | Datos | Cómo se levanta |
|---|---|---|---|
| Desarrollo local | Sí | PostgreSQL y Redis de [docker-compose.yml](../../docker-compose.yml) | `docker compose up -d` y los comandos de desarrollo |
| Pruebas reales | Sí, efímero | Contenedores desechables en los puertos 55432 y 56379, creados y eliminados por la propia suite | `npm run test:real` ([test-environment.ts](../../tests/real/helpers/test-environment.ts)) |
| Vista previa | Solo frontend | La vista previa del frontend apunta a la API que tenga configurada; no hay API ni base de vista previa | Automático al subir una rama |
| Preproducción (*staging*) | **No** | — | — |
| Producción | Sí | Servicios gestionados | Ver [Mapa de despliegue](01-mapa-de-despliegue.md) |

La ausencia de preproducción significa que un cambio de esquema o de backend se prueba en local y después directamente en producción. La suite de pruebas reales protege su base rechazando cualquier conexión que no apunte a su instancia de prueba.

## Reglas para el manejo de secretos

- Ningún secreto se guarda en el repositorio, en la documentación ni en mensajes de commit.
- Las cadenas de conexión no se imprimen completas; el script [diagnostico-conexiones.js](../../scripts/diagnostico-conexiones.js) muestra solo protocolo, servidor y puerto.
- La clave privada JWT existe en un único lugar: donde se emiten tokens.
- En la arquitectura propuesta, los servicios que solo verifican tokens reciben únicamente la clave pública.

[← Índice](../README.md)
