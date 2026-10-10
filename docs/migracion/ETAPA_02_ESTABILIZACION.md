# ETAPA 2: Estabilización de Migraciones, Autorización y Flujos Existentes

**Fecha:** Octubre 2026  
**Rama:** `fix/etapa-2-estabilizacion`  
**Base:** `af7e0e80708b740a6eb420994153af74b1febb59` (Cierre de Etapa 1)  
**Respaldo:** `refs/backup/etapa-1/estado-inicial`  
**Responsable:** Arquitecto de Software & Ingeniero Backend Sénior  

---

## 1. Resumen Ejecutivo

La Etapa 2 de la migración de **SOCIAL-UNSCH** consolida la estabilidad estructural, la integridad relacional de la base de datos y la seguridad de la autorización de roles, preparando el sistema para su posterior desacoplamiento en servicios independientes sin incurrir en pérdida de datos ni degradación funcional.

Se han alcanzado los siguientes hitos verificados:
1. **Separación arquitectónica de DDL, catálogos y datos demo**: Las migraciones normales no ejecutan semillas demo ni tocan credenciales de usuarios. La evolución del esquema es idempotente mediante un motor con tabla de trazabilidad `schema_migrations` y bloqueo consultivo (`pg_try_advisory_lock`).
2. **Preservación total de datos y relaciones**: Se eliminó la destrucción de entidades en catálogos (`DELETE FROM faculties`, asignación de `professional_school_id = NULL`). Se conservan identificadores primarios y relaciones preexistentes.
3. **Propagación determinista de errores**: Todos los ejecutores y orquestadores finalizan con código de salida `1` ante cualquier fallo, abortando la ejecución en cascada y cerrando recursos sin exponer secretos.
4. **Restricción estricta de privilegios de registro público**: El rol `administrator` no puede ser autoasignado en registro público. Se implementó una política centralizada en `src/shared/auth/roles.ts`, con validación Zod defensiva (HTTP 400) y verificación a nivel de dominio en `AuthService` (HTTP 403 `ERR_AUTH_FORBIDDEN_ROLE`).
5. **Corrección de discrepancias en consultas y atomicidad**:
   - `carpooling.repository.ts`: Corregido `u.school_id` por `u.professional_school_id`, y resuelta la ambigüedad `academic_cycle` / `current_academic_cycle`.
   - `carpooling.service.ts`: Manejo atómico y limpieza compensatoria ante fallos posteriores a la creación de solicitudes para evitar registros huérfanos.
   - Restricción de duplicados en solicitudes de asientos mediante índice único parcial idempotente y validaciones lógicas.
6. **Validación automatizada con infraestructura real**: Conservación de los 368 tests mockeados (cobertura global > 90%) e incorporación de una nueva suite automatizada con contenedores desechables aislados de PostgreSQL 15 (`social_unsch_test_pg_etapa2`, puerto 55432) y Redis 7 (`social_unsch_test_redis_etapa2`, puerto 56379), con 5 suites y 25 pruebas de integración reales aprobadas.

---

## 2. Problemas Confirmados y Diagnóstico de Causa Raíz

| # | Componente / Flujo | Problema Diagnosticado | Causa Raíz | Impacto Operativo |
|---|---|---|---|---|
| 1 | `add_canonical_data.sql` / Seeds | Vaciado destructivo de catálogos y desvinculación masiva de usuarios. | Script ejecutaba `UPDATE users SET professional_school_id = NULL;` seguido de `DELETE FROM faculties;` y reseteo de secuencias. | Destrucción de integridad referencial, pérdida de escuelas de usuarios y publicaciones en bases existentes. |
| 2 | `migrate_all.ts` / Migraciones | Acoplamiento de datos demo e inserción de administradores en la migración normal. | `migrate_all.ts` encadenaba `run_seed.ts` como paso obligatorio, insertando `admin@unsch.edu.pe` con contraseña compartida y `has_accepted_terms = true`. | Riesgo severo de seguridad en producción y alteración indeseada de registros. |
| 3 | Ejecutores de Migración | Errores silenciosos y códigos de salida no diferenciados. | Scripts capturaban errores imprimiendo en consola pero finalizaban con `process.exit(0)` o sin establecer `process.exitCode = 1`. | CI/CD y orquestadores interpretaban fallos graves como despliegues exitosos. |
| 4 | Registro de Usuarios (`auth.validators.ts`, `auth.service.ts`) | Autoasignación de rol `administrator` permitida en endpoint público. | `registerSchema` incluía `administrator` en el enum de roles y `AuthService` lo persistía directamente. | Escalada de privilegios trivial por parte de usuarios externos. |
| 5 | Repositorio Carpooling (`carpooling.repository.ts`) | Fallo en consulta de metadata de pasajero por columna inexistente. | Consulta hacía `JOIN professional_schools ps ON u.school_id = ps.id`, cuando la columna en `users` es `professional_school_id`. | Solicitud de asiento se creaba en BD pero la consulta posterior fallaba, retornando HTTP 500 y dejando un registro huérfano. |
| 6 | Esquema `users` | Discrepancia entre `current_academic_cycle` y `academic_cycle`. | `001_base_schema.sql` definía `current_academic_cycle`, mientras migraciones posteriores consultaban `academic_cycle`. | Inconsistencia en filtros de carpooling y perfiles. |
| 7 | Infraestructura de Pruebas | Falta de validación sobre motores reales de persistencia y concurrencia. | Las pruebas existentes se basaban 100% en dobles (`jest.mock('pg')`, `jest.mock('ioredis')`), sin probar bloqueos `FOR UPDATE` ni scripts Lua. | Incapacidad de detectar fallos reales de concurrencia, TTL o sintaxis SQL. |

---

## 3. Soluciones Implementadas y Archivos Modificados

### 3.1. Separación de DDL, Catálogos y Semillas Demo

Se estructuró la evolución de la base de datos en tres etapas desacopladas:

1. **Evolución del Esquema (DDL Idempotente)**:
   - Directorio: `src/database/migrations/sql/`
     - `001_base_schema.sql`: Extensiones, tipos enum (`user_role`, `project_type`, `item_condition`, `radar_status`), tablas base (`faculties`, `professional_schools`, `users`, `feed_posts`).
     - `002_matchmaking.sql`: Tablas de proyectos, perfiles e interacciones de matchmaking con timestamps e índices.
     - `003_credits_and_wiki.sql`: Tablas de archivos académicos, tags y libro mayor de créditos con triggers de saldo.
     - `004_moderation_and_carpooling.sql`: Tablas de reportes, auditoría, rutas y solicitudes de carpooling.
     - `005_canonical_extensions.sql`: Extensiones canónicas de alertas de campus, enums complementarios e índice único parcial para solicitudes activas de carpooling (`idx_carpooling_requests_active_unique`).
   - Gestor: `src/database/migrations/migrator.ts`. Implementa tabla de trazabilidad `schema_migrations` (`version`, `name`, `checksum`, `applied_at`) y bloqueo consultivo `pg_try_advisory_lock(948201)` para evitar ejecuciones concurrentes.

2. **Carga y Sincronización de Catálogos Canónicos**:
   - Módulo: `src/database/migrations/load_catalogs.ts`.
   - Lee el catálogo canónico (9 facultades, 31 escuelas, 15 pabellones).
   - Utiliza claves naturales (`name`, `code`) para buscar entidades existentes. Si existen, preserva sus claves primarias `id` y asociaciones intactas; si faltan, las inserta con `ON CONFLICT DO NOTHING`.
   - Sincroniza secuencias numéricas de PostgreSQL (`setval(...)`) para prevenir conflictos de clave en inserciones futuras.
   - **No vacía tablas ni pone en `NULL` relaciones de usuarios o publicaciones**.

3. **Carga de Datos de Demostración (Opcional y Restringida)**:
   - Módulo: `src/database/migrations/load_demo_seed.ts`.
   - Requiere confirmación explícita mediante la variable `ALLOW_DEMO_SEED=true` o el argumento CLI `--confirm-demo`.
   - Función guardiana `assertSafeDemoEnvironment()`: Bloquea inmediatamente la ejecución si:
     - `NODE_ENV === 'production'`.
     - La URL de conexión apunta a dominios remotos conocidos (`supabase.co`, `onrender.com`, `aws`, `azure`, `gcp`).
     - Falta la confirmación explícita.
   - Inserta usuarios y perfiles ficticios mediante `ON CONFLICT (email) DO NOTHING` sin alterar usuarios existentes, contraseñas ni roles.

### 3.2. Autorización y Política de Registro Público

- **Archivo centralizado**: `src/shared/auth/roles.ts`
  - Define `ALL_ROLES = ['student', 'alumnus', 'professor', 'administrator']`.
  - Define `PUBLIC_REGISTRATION_ROLES = ['student', 'alumnus', 'professor']`.
  - Función `assertPublicRegistrationRole(role)`: Lanza `AppError(..., 403, 'ERR_AUTH_FORBIDDEN_ROLE')` si se intenta autoasignar `administrator` o un rol ajeno.
- **Validadores**: `src/modules/auth/auth.validators.ts`
  - Restringe `role` en `registerSchema` exclusivamente a `PUBLIC_REGISTRATION_ROLES`, retornando error explicativo en validación previa (HTTP 400).
- **Servicio**: `src/modules/auth/auth.service.ts`
  - Ejecuta `assertPublicRegistrationRole(userData.role)` como defensa en profundidad dentro de la capa de dominio antes de llamar al repositorio.
- **Frontend**: `app/(auth)/register/page.tsx`
  - Tipado de estado restringido a `'student' | 'alumnus' | 'professor'`.
- **Clarificación de Roles y Verificación**:
  - `professor` y `alumnus` corresponden a **declaraciones del usuario** al momento del registro, sujetas a posterior validación documental administrativa.
  - La validación del dominio `@unsch.edu.pe` mediante expresión regular acredita exclusivamente el formato del correo institucional, **no constituye prueba de propiedad del buzón**. La confirmación de titularidad requiere verificación por enlace temporal o token de activación (pendiente para etapas de infraestructura/Auth).

### 3.3. Inconsistencias de Consultas y Atomicidad en Carpooling

- **Archivo**: `src/modules/carpooling/carpooling.repository.ts`
  - Corregido el join en `getPassengerMeta`: `JOIN professional_schools ps ON u.professional_school_id = ps.id`.
  - Selección segura de ciclo académico: `COALESCE(u.academic_cycle, u.current_academic_cycle, 1) as academic_cycle`.
  - Adición de método `deleteRequest(requestId)` para compensación transaccional.
- **Archivo**: `src/modules/carpooling/carpooling.service.ts`
  - Bloque `try / catch` compensatorio en `requestSeat`: Si la consulta de metadatos o una operación posterior falla tras la inserción de la solicitud, se invoca `deleteRequest(request.id)` para evitar solicitudes huérfanas en estado `SEAT_REQUESTED`.
  - Validación de solicitudes duplicadas activas (`SEAT_REQUESTED` o `SEAT_CONFIRMED`) previas a la creación.
- **Transaccionalidad en `confirmSeat`**:
  - Se mantiene el bloqueo pesimista `SELECT ... FROM carpooling_routes ... FOR UPDATE` y `SELECT ... FROM carpooling_requests ... FOR UPDATE`.
  - Verificación de conductor legítimo (`route.driver_id === driverId`), rechazando terceros con `ERR_CARPOOLING_FORBIDDEN`.
  - Verificación de estado de solicitud (`status === 'SEAT_REQUESTED'`), impidiendo que una confirmación repetida vuelva a descontar asientos y retornando `ERR_CARPOOLING_INVALID_STATE`.
  - Manejo seguro de concurrencia: Si múltiples confirmaciones compiten por el último asiento, la transacción serializada garantiza que una sola obtenga el asiento y la subsiguiente falle con `ERR_CARPOOLING_NO_SEATS` sin dejar asientos negativos.

---

## 4. Comandos de Operación

Se han configurado comandos diferenciados y reproducibles en `package.json`:

| Comando | Script | Propósito | Entorno |
|---|---|---|---|
| `npm run db:migrate` | `run_migrate.ts` | Aplica migraciones DDL idempotentes (`001` a `005`) registrando en `schema_migrations`. | Todos (Local, Staging, Producción) |
| `npm run db:catalogs` | `run_catalogs.ts` | Sincroniza catálogos canónicos de facultades, escuelas y pabellones sin alterar datos. | Todos |
| `npm run db:migrate:status` | `run_status.ts` | Inspecciona el estado de migraciones aplicadas y pendientes. | Todos |
| `npm run db:seed:demo` | `run_demo_seed.ts` | Inserta cuentas y proyectos ficticios de prueba. Bloqueado en producción. | Solo desarrollo local |
| `npm run db:migrate:all` | `migrate_all.ts` | Orquestador: ejecuta `runMigrations` y `loadCatalogs` de forma no destructiva. | Todos |
| `npm test` | `jest.config.ts` | Ejecuta la suite de 18 suites y 368 pruebas unitarias/integración mockeadas. | CI/CD, Local |
| `npm run test:coverage` | `jest.config.ts` | Comprueba umbrales de cobertura estricta (>= 90% en 4 ejes). | CI/CD, Local |
| `npm run test:real` | `jest.real.config.ts` | Levanta contenedores desechables aislados de PostgreSQL y Redis y corre 25 pruebas reales. | Local, CI con Docker |

---

## 5. Procedimientos Operativos para Base de Datos

### 5.1. Procedimiento para Instalación Nueva (Base Vacía)

```bash
# 1. Configurar variables de entorno apuntando a la base de datos destino
export DATABASE_URL="postgresql://usuario:clave@host:5432/social_unsch"

# 2. Ejecutar evolución del esquema
npm run db:migrate

# 3. Cargar catálogos canónicos indispensables
npm run db:catalogs

# 4. Verificar estado final
npm run db:migrate:status
```

Resultado esperado:
- 5 migraciones aplicadas registradas en `schema_migrations`.
- 9 facultades, 31 escuelas profesionales y 15 pabellones sincronizados.
- Cero cuentas de usuario y cero publicaciones creadas (entorno limpio).

### 5.2. Procedimiento para Actualización de Base de Datos Existente

> [!IMPORTANT]
> **Respaldo previo obligatorio**: Antes de aplicar cualquier cambio sobre una base de datos con datos reales, genere un respaldo lógico completo.

```bash
# 1. Respaldo de seguridad previo
pg_dump -h <HOST> -U <USUARIO> -d <DB> -F c -b -v -f backup_pre_etapa2_$(date +%Y%m%d_%H%M%S).dump

# 2. Inspeccionar estado actual
npm run db:migrate:status

# 3. Aplicar migraciones pendientes
npm run db:migrate

# 4. Sincronizar catálogos canónicos (preserva IDs y relaciones existentes)
npm run db:catalogs

# 5. Confirmar estado
npm run db:migrate:status
```

Garantías de seguridad:
- No se ejecutan sentencias `DROP TABLE` ni `DELETE FROM`.
- Las escuelas y facultades existentes se identifican por nombre y conservan sus `id`.
- Los usuarios, publicaciones y archivos vinculados conservan sus claves foráneas.

### 5.3. Procedimiento para Base de Datos Parcialmente Migrada (Adopción)

Si la base de datos ya cuenta con algunas tablas históricas creadas manualmente o por scripts antiguos:

1. Ejecutar `npm run db:migrate:status`.
2. Las migraciones están diseñadas con cláusulas `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y bloques anónimos PL/pgSQL que verifican la existencia de tipos enum y columnas.
3. El migrador detectará las migraciones no registradas en `schema_migrations` y las aplicará de forma segura sin fallar por duplicidad estructural.
4. Si una tabla ya contenía datos, la migración `005_canonical_extensions.sql` verifica previamente si existen registros duplicados antes de construir índices únicos condicionales.

---

## 6. Pruebas Ejecutadas y Resultados

### 6.1. Suite Existente con Dobles (Jest Mocked)
- **Comando**: `npm run test:coverage`
- **Suites**: 18 pasadas de 18.
- **Pruebas**: 368 pasadas de 368.
- **Cobertura obtenida**:
  - Statements: 94.26% (Umbral: >= 90%)
  - Branches: 91.32% (Umbral: >= 90%)
  - Functions: 95.38% (Umbral: >= 90%)
  - Lines: 94.38% (Umbral: >= 90%)

### 6.2. Nueva Suite Automatizada con PostgreSQL y Redis Reales
- **Comando**: `npm run test:real`
- **Infraestructura**:
  - Contenedor PostgreSQL 15: `social_unsch_test_pg_etapa2` en `127.0.0.1:55432`.
  - Contenedor Redis 7: `social_unsch_test_redis_etapa2` en `127.0.0.1:56379`.
  - Contenedores de otros proyectos (`buzon-comedor-unsch`, `agrocontrol`): Intactos.
- **Resultados**: 5 suites pasadas de 5, 25 pruebas pasadas de 25.

| Suite Real | Escenarios Automatizados | Resultado |
|---|---|---|
| `migrations.real.test.ts` | 1. Instalación limpia aplica 5 DDLs y registra `schema_migrations`.<br>2. Segunda ejecución consecutiva es idempotente y conserva conteos.<br>3. Preservación estricta de IDs, roles, contraseñas y consentimientos preexistentes.<br>4. Ausencia total de cuentas demo tras migración normal.<br>5. Bloqueo estricto del seed demo en producción o sin confirmación CLI.<br>6. Fallo transaccional deliberado revierte cambios (`ROLLBACK`). | **PASS** (6/6) |
| `auth.real.test.ts` | 1. Registro de estudiante con hash Bcrypt real y login con JWT RS256 persistente.<br>2. Rechazo expreso del rol `administrator` sin persistencia en BD.<br>3. Rechazo de roles desconocidos (`superadmin`).<br>4. Credenciales inválidas devuelven 401 sin revelar existencia de cuenta.<br>5. Rutas protegidas rechazan peticiones sin token o con token alterado. | **PASS** (5/5) |
| `carpooling.real.test.ts` | 1. Consulta de metadatos con columnas reales (`professional_school_id`, `academic_cycle`).<br>2. Rechazo de solicitudes duplicadas para la misma ruta activa.<br>3. Verificación de conductor autorizado (`ERR_CARPOOLING_FORBIDDEN`).<br>4. Confirmación autorizada descuenta asiento y revela contactos recíprocos.<br>5. Confirmación repetida no descuenta asientos adicionales (`ERR_CARPOOLING_INVALID_STATE`).<br>6. Competencia concurrente por el último asiento con bloqueo pesimista `FOR UPDATE`.<br>7. Limpieza compensatoria ante fallo intermedio sin solicitudes huérfanas. | **PASS** (7/7) |
| `feed_matchmaking.real.test.ts` | 1. Creación de publicaciones con `professional_school_id` y filtrado por escuela.<br>2. Máquina de estados de matchmaking (Like pendiente -> Doble Match aceptado -> desvelamiento de contactos Ley 29733 -> rechazo de autolike). | **PASS** (2/2) |
| `radar.real.test.ts` | 1. Registro de votos y rechazo de duplicados en la misma ventana.<br>2. Consenso crowdsourcing al completar 3 usuarios distintos.<br>3. Lectura de estado consolidado mediante pipelines de Redis.<br>4. Verificación de TTL razonable en Redis (<= 900 segundos).<br>5. Rechazo de nodos o estados inválidos. | **PASS** (5/5) |

### 6.3. Verificación de Compilación y Tipos
- `npm run build` (`tsc --project tsconfig.backend.json`): **Código de salida 0**.
- `npm run build:frontend` (`next build`): **Código de salida 0** (14 páginas estáticas compiladas y optimizadas).
- `npx tsc --noEmit -p tsconfig.json`: **Código de salida 0**.
- `npx tsc --noEmit -p tsconfig.jest.json`: **Código de salida 0**.

---

## 7. Plan de Aplicación Futura y Estrategia de Recuperación

### 7.1. Distinción entre Reversión de Código y Reversión de Datos

- **Reversión de Código (Rollback Git)**: Si un despliegue de backend o frontend presenta defectos de software, se revierte el contenedor o release a la versión previa (`git checkout / git revert`). Dado que las migraciones son compatibles hacia atrás (no eliminan columnas activas ni renombran destructivamente), la versión previa del código seguirá operando contra el esquema actual.
- **Reversión de Datos (No destructiva)**:
  - **Bajo ninguna circunstancia se debe ejecutar `DROP TABLE` o `DROP SCHEMA` como rollback genérico en entornos con datos reales**.
  - Si una migración agregó una columna nullable o un índice, su presencia no perjudica el funcionamiento de la versión previa.
  - La reversión de datos consiste en:
    1. Si la migración falló durante la ejecución: La transacción interna ejecuta `ROLLBACK` automáticamente.
    2. Si se requiere deshacer un cambio estructural incompatible: Se debe aplicar una **migración hacia adelante** (*forward migration*, por ejemplo `006_revert_...sql`) documentada y probada previamente.
    3. Si hubo corrupción lógica de datos: Restauración desde el respaldo lógico `pg_dump` previo.

---

## 8. Compatibilidad y Pendientes para Etapas Posteriores

### 8.1. Compatibilidad de Contratos
- Se mantuvieron intactos los contratos HTTP de `/api/v1/auth`, `/api/v1/carpooling`, `/api/v1/feed`, `/api/v1/matchmaking` y `/api/v1/radar`.
- Las modificaciones en `carpooling` y `feed` corrigieron errores de consulta internos sin alterar las interfaces esperadas por el frontend.

### 8.2. Módulos Simulados y Pendientes Funcionales
Los siguientes módulos se mantienen según su estado previo para las etapas funcionales posteriores (Etapas 3 y siguientes):
- **Wiki-Banco de Archivos**: Almacenamiento local de metadatos; pendiente integración con servicio de almacenamiento de objetos (S3/Supabase Storage).
- **Marketplace y Empleos**: Módulos simulados en frontend; lógica de negocio completa pendiente de desarrollo.
- **Verificación de Titularidad de Correo**: Pendiente flujo de envío de correos transaccionales con token de confirmación para validar que el usuario es el legítimo propietario de la cuenta `@unsch.edu.pe`.
- **Consola Administrativa**: Se conservan las cuentas de administrador existentes en base de datos; la consola web de administración continúa como pendiente funcional.
