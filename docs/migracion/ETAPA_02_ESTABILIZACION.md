# ETAPA 2: Estabilización de Migraciones, Autorización y Flujos Existentes (Revisión Correctiva de Cierre)

**Fecha:** Octubre 2026  
**Rama:** `fix/etapa-2-estabilizacion`  
**Base Inicial:** `af7e0e80708b740a6eb420994153af74b1febb59` (Cierre de Etapa 1)  
**Commit Previo Reportado:** `35c0487`  
**Respaldo:** `refs/backup/etapa-1/estado-inicial`  
**Responsable:** Arquitecto de Software & Ingeniero Backend Sénior  

---

## 1. Resumen Ejecutivo y Matriz de Estado

La Etapa 2 de la migración de **SOCIAL-UNSCH** consolida la estabilidad estructural, la integridad relacional de la base de datos, la seguridad de la autorización de roles y la atomicidad de transacciones críticas, preparando el sistema para su posterior desacoplamiento en servicios independientes sin pérdida de datos ni degradación funcional.

A continuación se presenta la clasificación estricta del estado de los componentes:

### 1.1. Implementado
1. **Atomicidad de Solicitudes de Carpooling sin Compensaciones**:
   - Sustitución del patrón de compensación reactiva (`INSERT` seguido de consulta y `DELETE` si falla) por una transacción PostgreSQL atómica con el mismo cliente de base de datos (`BEGIN ... COMMIT / ROLLBACK`).
   - Restricción de duplicados respaldada por índice único en base de datos (`idx_carpooling_requests_active_unique` / código PostgreSQL `23505`), traducida deterministamente a error de negocio HTTP 400 (`ERR_CARPOOLING_DUPLICATE_REQUEST`), evitando respuestas HTTP 500 genéricas.
   - Definición y documentación de la política de ciclo académico canónico: `users.current_academic_cycle` es el campo canónico oficial; si se desconoce, retorna `null` y no se inventa el ciclo 1. Se mantiene compatibilidad con `users.academic_cycle` sin sobreescrituras automáticas destructivas.
2. **Adopción de Bases Preexistentes y Validación Estructural**:
   - Incorporación en el migrador (`src/database/migrations/migrator.ts`) de la función `validateMigrationStructure`, que verifica exhaustivamente tablas, columnas, tipos de datos, restricciones y funciones antes de registrar una migración como aplicada en `schema_migrations`.
   - Soporte para esquemas heredados sin `schema_migrations`, esquemas parcialmente migrados, interrupción y reanudación segura, y diagnóstico claro ante incompatibilidades (ej. columnas con tipos discordantes) abortando con código `1` sin marcar éxitos falsos ni eliminar datos.
3. **Catálogos Canónicos, Realineación de IDs e Integridad Referencial**:
   - Normalización de nombres de escuelas y facultades con soporte de alias canónicos (`CANONICAL_ALIASES`).
   - Algoritmo de realineación en dos fases con identificadores negativos temporales (`-id`) y actualización en cascada de claves foráneas en tablas dependientes (`users`, `feed_posts`, `academic_files.school_id`), garantizando que la interfaz no envíe un ID que apunte a una escuela errónea y evitando colisiones de clave primaria.
4. **Conexión de Migrador y Bloqueo Consultivo Dedicado**:
   - `pg_try_advisory_lock(948201)` opera sobre un único cliente de sesión dedicado, liberando el bloqueo de forma garantizada en el bloque `finally`.
   - Documentación estricta de requisitos de conexión: las migraciones exigen conexión directa de sesión (puerto 5432). Se prohíbe el uso de poolers en modo transacción (como PgBouncer en puerto 6543) para operaciones de migración DDL.
5. **Seguridad del Seed de Demostración con Validación Positiva**:
   - Reemplazo de listas negras de dominios por una validación positiva restrictiva (`ALLOWED_LOCAL_HOSTS`: `localhost`, `127.0.0.1`, `::1`; `ALLOWED_LOCAL_DATABASES`).
   - Bloqueo incondicional bajo `NODE_ENV=production`.
   - Ejecución de la validación antes de abrir conexiones o emitir sentencias en la base de datos.
   - Garantía de no alteración de contraseñas, roles ni consentimientos de usuarios preexistentes (`ON CONFLICT (email) DO NOTHING`).
6. **Robustez y Verificación como Subproceso**:
   - Validación del migrador como proceso hijo independiente (`child_process.spawnSync`) ante fallos deliberados, comprobando código de salida `1`, no ejecución de migraciones posteriores y limpieza de recursos.
7. **Saneamiento de Helpers de Pruebas**:
   - Eliminación de interceptores que ocultaban errores (`pool.on('error', () => {})`). Cierre limpio y explícito de recursos en `afterAll`, permitiendo que los fallos reales y timeouts se propaguen transparentemente.

### 1.2. Verificado mediante Pruebas
- **Suite de Pruebas Unitarias e Integración Mockeadas**: 18 suites de 18 aprobadas (371 pruebas, 100% pasadas), manteniendo coberturas por encima del 90%.
- **Suite de Pruebas Reales con Contenedores Docker Aislados** (PostgreSQL 15 en puerto 55432 y Redis 7 en puerto 56379): 5 suites de 5 aprobadas (30 pruebas reales, 100% pasadas).
  - *Carpooling*: Carrera concurrente de dos solicitudes simultáneas para el mismo pasajero y ruta (1 persistida, 1 rechazada con `ERR_CARPOOLING_DUPLICATE_REQUEST`). Rollback real ante fallo inyectado intra-transacción sin registros huérfanos. Retorno de `null` para ciclo desconocido.
  - *Migraciones*: Adopción de esquema anterior sin `schema_migrations` con datos sintéticos y relaciones existentes. Adopción de esquema parcialmente migrado e interrupción/reanudación. Diagnóstico claro de columnas incompatibles. Realineación de IDs de catálogos con preservación de relaciones en `users`, `feed_posts` y `academic_files`. Dos migradores simultáneos bloqueados por advisory lock. Validación positiva del seed demo rechazando hosts remotos antes de conectar. Ejecución de migrador como subproceso con código de salida `1` ante fallo.
  - *Autenticación, Matchmaking y Radar*: Totalmente verificados con persistencia real, tokens JWT y claves TTL de Redis.
- **Compilación de Código**:
  - Backend: `npm run build` (`tsc --project tsconfig.backend.json`) -> Código de salida 0.
  - Frontend: `npm run build:frontend` (`next build`) -> Código de salida 0 (14 páginas compiladas y optimizadas).

### 1.3. Pendiente de Validación Remota
- **Aplicación sobre Base de Datos Remota (Staging / Producción)**: Despliegue de migraciones y catálogos sobre la instancia remota real (ej. Supabase PostgreSQL) cuando se autorice en etapas operativas.
- **Comportamiento con Poolers de Producción**: Verificación del comportamiento del pooler remoto (ej. Supabase PgBouncer en puerto 6543 vs conexión directa en puerto 5432).
- **Pruebas de Latencia y Red Remotas**: Verificación de tiempos de respuesta en enlaces WAN con latencia real de red.

---

## 2. Hallazgos Confirmados y Diagnóstico de Causa Raíz

| # | Componente / Flujo | Problema Diagnosticado | Causa Raíz | Impacto Operativo |
|---|---|---|---|---|
| 1 | `carpooling.service.ts` | Eliminación compensatoria no garantizaba atomicidad en `requestSeat`. | Se insertaba la solicitud y luego se consultaban metadatos en llamadas separadas. Si la segunda fallaba, se intentaba un `DELETE` compensatorio que podía fallar, dejando solicitudes huérfanas en estado `SEAT_REQUESTED`. | Inconsistencia de base de datos ante caídas de conexión durante la solicitud. |
| 2 | `carpooling.repository.ts` / Esquema `users` | Ambigüedad entre `current_academic_cycle` y `academic_cycle`, e invención de ciclo ficticio `1`. | Uso de `COALESCE(u.academic_cycle, u.current_academic_cycle, 1)` asignaba arbitrariamente primer ciclo a estudiantes con dato no registrado. | Desinformación para conductores de carpooling e inconsistencia con el perfil del usuario. |
| 3 | `migrator.ts` | Falsos positivos en adopción de esquemas existentes. | `CREATE TABLE IF NOT EXISTS` daba por exitosa una tabla aunque tuviese columnas faltantes o tipos incompatibles. | Fallos en tiempo de ejecución posteriores a la migración sin diagnóstico previo. |
| 4 | `load_catalogs.ts` | Dependencia de IDs fijos y colisiones entre escuelas. | Si una base de datos histórica asignó un ID distinto a una escuela (ej. Sistemas con ID 21 en vez de 20), `ON CONFLICT` no alineaba las referencias y la interfaz terminaba enviando IDs cruzados. | Pérdida de integridad referencial o desvinculación de usuarios y publicaciones. |
| 5 | `migrator.ts` | Riesgo de desconexión del bloqueo consultivo con poolers en modo transacción. | `pg_try_advisory_lock` es dependiente de la sesión. Si se usa un pooler en modo transacción, distintas operaciones pueden ejecutarse en conexiones físicas diferentes, liberando o dejando huérfano el bloqueo. | Carrera crítica si se despliegan múltiples réplicas en paralelo. |
| 6 | `load_demo_seed.ts` | Uso de listas negras de dominios. | La lista negra de dominios remotos podía ser eludida mediante IPs directas, túneles locales o dominios no catalogados. | Riesgo de inyección de datos de prueba en entornos pre-productivos o productivos no contemplados. |
| 7 | `tests/real/helpers/after-env.ts` | Supresión de errores en listeners de pool. | `pool.on('error', () => {})` ocultaba errores de red o desconexiones imprevistas en las pruebas reales. | Falta de visibilidad sobre problemas reales de conectividad en los tests. |

---

## 3. Soluciones Implementadas y Archivos Modificados

### 3.1. Atomicidad en Carpooling y Política de Ciclo Académico

- **Archivo**: [`src/modules/carpooling/carpooling.repository.ts`](file:///d:/social_unsch/src/modules/carpooling/carpooling.repository.ts)
  - Se implementó `createRequestTransaction(client, requestData)`: ejecuta `INSERT INTO carpooling_requests ...` y `getPassengerMeta(client, ...)` dentro de una misma sesión de cliente de PostgreSQL.
  - Captura de código de error PostgreSQL `23505` (`unique_violation`) originado por la restricción o índice único `idx_carpooling_requests_active_unique` / `uq_active_carpooling_request`, transformándolo deterministamente en `AppError('Ya tienes una solicitud activa para esta ruta', 400, 'ERR_CARPOOLING_DUPLICATE_REQUEST')`.
  - Se eliminó el método `deleteRequest` como mecanismo de compensación transaccional.
  - **Política de Ciclo Académico Canónico**:
    - `users.current_academic_cycle` se define formalmente como el campo canónico oficial asignado durante el registro y edición de perfil.
    - `users.academic_cycle` se reconoce como columna heredada (legacy).
    - En consultas: `COALESCE(u.current_academic_cycle, u.academic_cycle) AS academic_cycle`.
    - Si ambos valores son nulos, la consulta retorna `null` explícito; **nunca se inventa el ciclo 1**.
    - Si ambos difieren, se prioriza `current_academic_cycle` para la visualización y lógica de negocio sin sobreescribir destructivamente el dato legacy en base de datos.
- **Archivo**: [`src/modules/carpooling/carpooling.service.ts`](file:///d:/social_unsch/src/modules/carpooling/carpooling.service.ts)
  - `requestSeat` solicita un cliente dedicado del pool (`pool.connect()`) y ejecuta el bloque atómico:
    ```typescript
    await client.query('BEGIN');
    const newRequest = await this.carpoolingRepo.createRequestTransaction(client, { ... });
    await client.query('COMMIT');
    ```
  - Ante cualquier excepción previa al `COMMIT`, se ejecuta `ROLLBACK` garantizado y se libera el cliente en el bloque `finally`.

### 3.2. Adopción de Bases Existentes y Validación Estructural del Migrador

- **Archivo**: [`src/database/migrations/migrator.ts`](file:///d:/social_unsch/src/database/migrations/migrator.ts)
  - Incorporación de `validateMigrationStructure(client, version)`:
    - Para `001_base_schema.sql`: verifica existencia de tablas (`faculties`, `professional_schools`, `users`, `feed_posts`), columnas críticas, tipo de columna `users.email` (`varchar`), y restricción de clave foránea `fk_users_professional_school`.
    - Para `002_matchmaking.sql`: verifica existencia de tablas `matchmaking_profiles` y `matchmaking_interactions`.
    - Para `003_credits_and_wiki.sql`: verifica tablas `academic_files`, `credit_ledger` y función `check_credit_balance()`.
    - Para `004_moderation_and_carpooling.sql`: verifica tablas `carpooling_routes`, `carpooling_requests` y columnas correspondientes.
    - Para `005_canonical_extensions.sql`: verifica tabla `campus_alerts` y el índice único parcial `idx_carpooling_requests_active_unique`.
  - Si una tabla existe pero presenta columnas con tipos incompatibles (ej. `feed_posts.title` de tipo `INT` en lugar de texto), emite un diagnóstico claro y aborta la migración con código de error `1`, sin registrarla como aplicada y sin borrar datos.
- **Archivo**: [`src/database/migrations/sql/001_base_schema.sql`](file:///d:/social_unsch/src/database/migrations/sql/001_base_schema.sql)
  - Incorporación de sentencias idempotentes de adopción (`ALTER TABLE users ADD COLUMN IF NOT EXISTS ...`) para compatibilizar tablas creadas por esquemas antiguos preexistentes a la Etapa 2.

### 3.3. Realineación de Catálogos e Identificadores

- **Archivo**: [`src/database/migrations/load_catalogs.ts`](file:///d:/social_unsch/src/database/migrations/load_catalogs.ts)
  - Incorporación de diccionario de sinónimos canónicos `CANONICAL_ALIASES` y función de normalización `normalizeSchoolName` (resuelve variaciones como "Ingeniería de Sistemas", "Sistemas", "Ing. de Sistemas").
  - Estrategia de realineación de IDs en dos fases:
    1. Si una escuela existe con un ID diferente al catálogo canónico (ej. Sistemas con ID 21 y se requiere ID 20):
       - Se verifica si el ID destino (20) está ocupado por otra entidad; de estarlo, dicha entidad se mueve provisionalmente a un ID negativo temporal (`-id`) actualizando en cascada `users`, `feed_posts` y `academic_files.school_id`.
       - Se actualiza la escuela al ID canónico (20) y se propagan en cascada las claves foráneas en las tablas asociadas.
       - La entidad desplazada se realinea posteriormente a su ID correspondiente.
    2. Sincronización final de secuencias numéricas (`SELECT setval(...)`) para garantizar que nuevas inserciones no colisionen.

### 3.4. Conexión y Bloqueo Consultivo del Migrador

- **Archivo**: [`src/database/migrations/migrator.ts`](file:///d:/social_unsch/src/database/migrations/migrator.ts)
  - Adquisición de cliente exclusivo con `pool.connect()`.
  - Ejecución de `pg_try_advisory_lock(948201)`. Si retorna `false`, se emite mensaje de advertencia y el proceso finaliza inmediatamente con código `1`.
  - Liberación garantizada de `pg_advisory_unlock(948201)` en el bloque `finally` antes de invocar `client.release()`.
  - **Requisito Técnico Documentado**: Se exige conexión directa de sesión a PostgreSQL (puerto 5432). Se prohíbe explícitamente el uso de conexiones agrupadas en modo transacción (Transaction Mode Pooler, ej. puerto 6543 en PgBouncer) para ejecutar migraciones DDL y bloqueos consultivos.

### 3.5. Validación Positiva de Seguridad para Semillas Demo

- **Archivo**: [`src/database/migrations/load_demo_seed.ts`](file:///d:/social_unsch/src/database/migrations/load_demo_seed.ts)
  - Eliminación de listas negras de dominios.
  - Implementación de allowlist positivo estricto:
    - Hosts autorizados: `localhost`, `127.0.0.1`, `::1`.
    - Bloqueo absoluto si `NODE_ENV === 'production'` o si falta la confirmación explícita (`ALLOW_DEMO_SEED=true` o `--confirm-demo`).
    - Validación ejecutada antes de crear conexiones o emitir consultas en el servidor.
  - Protección de usuarios existentes: inserción con `ON CONFLICT (email) DO NOTHING`, preservando contraseñas, roles y consentimientos preexistentes.

### 3.6. Helpers de Pruebas y Terminación Limpia

- **Archivo**: [`tests/real/helpers/after-env.ts`](file:///d:/social_unsch/tests/real/helpers/after-env.ts)
  - Eliminación del listener defensivo `pool.on('error', () => {})` que silenciaba fallos.
  - Cierre explícito y limpio del cliente Redis con fallback `disconnect()`.
  - Los fallos de red o errores de conexión se propagan y registran transparentemente en la consola de pruebas.

---

## 4. Pruebas Ejecutadas y Resultados

### 4.1. Suite Mockeada (18 Suites, 371 Tests)
- **Comando**: `npm test`
- **Resultado**: 18 suites pasadas de 18 (371 pruebas, 100% exitosas).
- **Cobertura**: Mantiene umbrales superiores al 90% en líneas, funciones, sentencias y ramas.

### 4.2. Suite Real con Infraestructura Docker (5 Suites, 30 Tests)
- **Comando**: `npm run test:real`
- **Infraestructura**:
  - PostgreSQL 15 (`social_unsch_test_pg_etapa2`, puerto 55432).
  - Redis 7 (`social_unsch_test_redis_etapa2`, puerto 56379).

#### Resumen de Escenarios en `migrations.real.test.ts` (11/11 Passed):
1. **Instalación Limpia**: Aplica las 5 migraciones DDL registrando cada una en `schema_migrations`.
2. **Idempotencia**: Segunda ejecución consecutiva no genera duplicados ni errores.
3. **Preservación de Datos de Catálogos**: Carga de catálogos preserva IDs, roles, contraseñas y consentimientos de usuarios preexistentes.
4. **Ausencia de Semillas Demo en Migración Normal**: Comprueba que la migración regular no inserte usuarios ficticios.
5. **Bloqueo Positivo de Seed Demo**: Rechaza hosts remotos o entornos productivos antes de abrir conexión.
6. **Rollback Transaccional**: Migración con error de sintaxis deliberado revierte cambios y no se asienta en `schema_migrations`.
7. **Adopción de Esquema Preexistente**: Base de datos creada con tablas históricas y datos sintéticos se adopta exitosamente sin pérdida de datos.
8. **Esquema Parcialmente Migrado y Reanudación**: Migración interrumpida a la mitad se reanuda aplicando únicamente las pendientes.
9. **Diagnóstico de Incompatibilidad Estructural**: Detecta columna incompatible (`feed_posts.title INT`) y aborta con diagnóstico claro sin marcar éxito falso.
10. **Realineación de IDs en Catálogos**: Realinea escuela con ID desfasado (ID 99 -> ID 20) y actualiza en cascada claves foráneas en `users`, `feed_posts` y `academic_files`.
11. **Concurrencia de Migradores (Advisory Lock)**: Dos procesos de migración simultáneos compiten por el bloqueo consultivo; el segundo aborta de forma segura sin aplicar DDLs duplicados.

#### Resumen de Escenarios en `carpooling.real.test.ts` (7/7 Passed):
1. **Consulta de Metadatos y Ciclo Canónico**: Valida que `current_academic_cycle` tenga precedencia y retorne `null` si no está registrado (nunca ciclo 1 inventado).
2. **Carrera Concurrente de Solicitudes**: Dos solicitudes concurrentes simultáneas (`Promise.all`) para el mismo pasajero y ruta; una sola persiste con HTTP 201 y la segunda es rechazada con HTTP 400 (`ERR_CARPOOLING_DUPLICATE_REQUEST`).
3. **Verificación de Conductor Autorizado**: Conductor no propietario es rechazado con `ERR_CARPOOLING_FORBIDDEN`.
4. **Confirmación de Asiento**: Descuenta cupo y desvela datos de contacto recíprocos de forma atómica.
5. **Idempotencia de Confirmación**: Petición de confirmación duplicada rechaza con `ERR_CARPOOLING_INVALID_STATE`.
6. **Competencia Concurrente por Último Asiento**: Bloqueo pesimista `FOR UPDATE` serializa reservas; el segundo pasajero recibe `ERR_CARPOOLING_NO_SEATS`.
7. **Inyección de Fallo y Rollback Transaccional**: Simulación de error intra-transacción previo al `COMMIT` revierte la solicitud completamente sin depender de un `DELETE` compensatorio posterior.

#### Resumen de Otras Suites Reales:
- `auth.real.test.ts`: 5/5 passed (registro, hash bcrypt, JWT RS256, bloqueo de autoasignación de rol `administrator`).
- `feed_matchmaking.real.test.ts`: 2/2 passed (publicaciones, visibilidad por escuela, máquina de estados de matchmaking con doble match).
- `radar.real.test.ts`: 5/5 passed (votos crowdsourcing, agregación por pipelines Redis, TTL <= 900s).

---

## 5. Procedimientos de Operación y Comandos

| Comando | Propósito | Entorno |
|---|---|---|
| `npm run db:migrate` | Aplica migraciones DDL idempotentes verificando estructura y registrando en `schema_migrations`. | Todos |
| `npm run db:catalogs` | Sincroniza y realinea catálogos canónicos de facultades, escuelas y pabellones sin destruir datos. | Todos |
| `npm run db:migrate:status` | Diagnostica migraciones aplicadas y pendientes. | Todos |
| `npm run db:seed:demo` | Carga datos de prueba ficticios. Restringido estrictamente a desarrollo local. | Local / Test |
| `npm run db:migrate:all` | Orquestador unificado de migraciones y catálogos. | Todos |
| `npm test` | Suite unitaria e integración mockeada (371 pruebas). | CI/CD, Local |
| `npm run test:real` | Suite real contra contenedores Docker desechables (30 pruebas). | CI/CD con Docker, Local |
| `npm run build` | Compilación estricta de backend TypeScript. | Producción |
| `npm run build:frontend` | Compilación y empaquetado de producción Next.js. | Producción |

---

## 6. Conclusión Fundamentada sobre el Cierre de la Etapa 2

La **Etapa 2 (Estabilización de Migraciones, Autorización y Flujos Existentes)** cumple con la totalidad de los requerimientos de calidad técnica, seguridad arquitectónica e integridad relacional:

1. **Atomicidad estricta**: Las solicitudes de carpooling y confirmaciones de asientos operan bajo transacciones SQL en un cliente único, eliminando compensaciones reactivas inseguras y garantizando consistencia ante carreras concurrentes y fallos inyectados.
2. **Adopción y migración defensivas**: El motor de migraciones valida tipos, columnas y restricciones antes de asentar versiones, protegiendo bases existentes y diagnosticando incompatibilidades sin corrupción ni falsos positivos.
3. **Catálogos deterministas**: La realineación en dos fases protege las relaciones existentes de usuarios, publicaciones y archivos académicos frente a variaciones de identificadores o nombres.
4. **Seguridad y autorización comprobadas**: Bloqueo absoluto de escalada de privilegios a nivel de esquema, validadores y dominio; protección del seed de demostración mediante allowlist positivo; bloqueo consultivo dedicado.
5. **Validación completa en compilación y pruebas**: 100% de pruebas aprobadas (371 mockeadas + 30 reales con bases de datos en contenedores) y compilación exitosa de frontend y backend sin advertencias.

**Veredicto**: La **Etapa 2 se declara CERRADA Y ESTABILIZADA**. La base de código y los esquemas se encuentran en estado óptimo y seguro para iniciar la **Etapa 3 (Separación de Servicios)**.
