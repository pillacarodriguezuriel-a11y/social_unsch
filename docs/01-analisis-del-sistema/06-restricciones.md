# Restricciones

Una restricción es una condición que el diseño debe aceptar; no se elige. Se separan las verificadas en el repositorio de las que dependen de confirmación externa.

## Restricciones técnicas verificadas

| ID | Restricción | Evidencia | Consecuencia |
|---|---|---|---|
| RT-01 | Desde la etapa 3, frontend y backend son workspaces separados con dependencias propias, pero comparten un único lockfile | [package.json](../../package.json), [apps/api/package.json](../../apps/api/package.json), [apps/web/package.json](../../apps/web/package.json) | Un cambio de dependencias se instala con un solo `npm ci`; Vercel debe compilar desde `apps/web` ([ETAPA_03](../migracion/ETAPA_03_PREPARACION_SEPARACION.md)) |
| RT-02 | El backend se compila con TypeScript en modo `Node16` hacia `dist/` y arranca con `node dist/server.js` | [tsconfig.backend.json](../../apps/api/tsconfig.json), [package.json](../../package.json) | La plataforma de la API debe ejecutar un proceso Node de larga duración |
| RT-03 | Las migraciones leen archivos `.sql` en tiempo de ejecución mediante `ts-node` | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) | No se ejecutan desde `dist/`; requieren el código fuente y las dependencias de desarrollo |
| RT-04 | El bloqueo de migraciones usa un bloqueo consultivo de sesión de PostgreSQL | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) | Las migraciones necesitan una conexión que mantenga la sesión; un *pooler* en modo transacción no sirve |
| RT-05 | `bcrypt` es un módulo nativo | [package.json](../../package.json) | La versión de Node del entorno de compilación debe ser compatible |
| RT-06 | La URL de la API se fija al compilar el frontend | [api.ts](../../apps/web/app/lib/api.ts) | Cambiar la entrada de la API exige recompilar el frontend |
| RT-07 | El dominio de correo está fijado en código y en la base de datos | [auth.validators.ts](../../apps/api/src/modules/auth/auth.validators.ts), [001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql) | El sistema no es reutilizable para otra institución sin migración |
| RT-08 | La API no mantiene estado de sesión en memoria | [auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts) | Puede replicarse o dividirse sin compartir sesión |
| RT-09 | Los identificadores de usuario son UUID; los de catálogo, enteros secuenciales | [001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql) | Los identificadores de catálogo existentes deben conservarse en cualquier migración |
| RT-10 | No hay archivos de despliegue versionados (`vercel.json`, `render.yaml`, `Dockerfile`) | Raíz del repositorio | La configuración de despliegue vive en los paneles de cada plataforma |

## Restricciones de plataforma (pendientes de verificación)

No se tuvo acceso a los paneles; estas restricciones provienen de informes previos o de observación externa.

| ID | Restricción | Fuente | Estado |
|---|---|---|---|
| RP-01 | El frontend se despliega en Vercel desde `main` | API pública de despliegues de GitHub (2026-10-12) | Verificado por observación externa |
| RP-02 | La API se despliega en Render y se suspende por inactividad | Primera respuesta de unos 32 segundos, observada el 2026-10-10 y el 2026-10-12 | Inferencia a partir de la latencia; plan no confirmado |
| RP-03 | PostgreSQL está en Supabase; los proyectos del plan gratuito se pausan por inactividad | [ETAPA_01_LINEA_BASE.md](../migracion/ETAPA_01_LINEA_BASE.md) | Pendiente de verificación |
| RP-04 | Redis está en Upstash con TLS | [ETAPA_01_LINEA_BASE.md](../migracion/ETAPA_01_LINEA_BASE.md) | Pendiente de verificación |
| RP-05 | Los planes en uso son gratuitos | Informes previos | Pendiente de confirmar por el propietario |

## Restricciones académicas y organizativas (pendientes de confirmar)

| ID | Restricción | Estado |
|---|---|---|
| RA-01 | El proyecto se desarrolla y evalúa en el curso de Arquitectura de Software | Declarado por el autor |
| RA-02 | Un único desarrollador y operador | Inferido del historial de Git: un solo autor |
| RA-03 | Sin presupuesto para infraestructura de pago | Pendiente de confirmar |
| RA-04 | Plazos y entregables del curso | No documentados en el repositorio; pendiente de confirmar |
| RA-05 | El uso con datos reales de estudiantes implica obligaciones de la Ley N.º 29733 de protección de datos personales | Mencionado en el [README](../../README.md); no hay análisis de cumplimiento en el repositorio |

## Qué restringen a la arquitectura

- RA-02 y RA-03 descartan una plataforma de orquestación propia o varios equipos trabajando en paralelo: cualquier división en servicios debe poder operarla una persona.
- RT-01 y RT-10 son el primer obstáculo para separar servicios: antes de extraer nada hay que poder construir y desplegar cada parte por separado.
- RT-04 condiciona cómo se conecta el proceso de migraciones a la base de datos de producción.
- RP-02 y RP-03 limitan lo que puede prometerse en disponibilidad.

[← Índice](../README.md)
