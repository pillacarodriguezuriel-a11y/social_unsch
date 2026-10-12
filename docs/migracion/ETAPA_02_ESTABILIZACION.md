# ETAPA 2: Estabilización de Migraciones, Autorización y Flujos Existentes (Ajuste Final de Cierre)

**Fecha:** Octubre 2026  
**Rama:** `fix/etapa-2-estabilizacion`  
**Base Inicial:** `af7e0e80708b740a6eb420994153af74b1febb59` (Cierre de Etapa 1)  
**Commits Previos Reportados:** `35c0487`, `d16e6a6`, `a87fb5a`, `a9566c1`  
**Respaldo:** `refs/backup/etapa-1/estado-inicial`  
**Responsable:** Arquitecto de Software & Ingeniero Backend Sénior  

---

## 1. Resumen Ejecutivo y Matriz de Estado

La Etapa 2 de la migración de **SOCIAL-UNSCH** consolida la estabilidad estructural, la integridad relacional de la base de datos, la seguridad de la autorización de roles, la atomicidad de transacciones críticas y la conservación estricta de identificadores de catálogos históricos, preparando el sistema para su posterior desacoplamiento en servicios independientes sin pérdida de datos ni degradación funcional.

A continuación se presenta la clasificación estricta del estado de los componentes:

### 1.1. Implementado
1. **Conservación Estricta de Identificadores de Catálogos Existentes**:
   - Se retiró completamente la estrategia de reasignación automática de IDs mediante identificadores negativos provisionales.
   - Conservación incondicional de los IDs existentes de facultades, escuelas profesionales y pabellones: **cero modificaciones sobre claves primarias existentes (`id`)** y cero alteraciones en claves foráneas asociadas en `users`, `feed_posts` y `academic_files`.
   - Resolución inequívoca por claves naturales: coincidencia por nombre canónico normalizado (`normalizeSchoolName`) o código de carrera.
   - Diagnóstico y aborto transaccional ante correspondencias ambiguas: si una escuela coincide con múltiples entidades canónicas o si nombre y código discrepan entre sí, la transacción ejecuta `ROLLBACK` y aborta emitiendo un diagnóstico explícito sin aplicar mutaciones parciales.
   - Inserción de entidades canónicas faltantes sin reutilizar IDs ocupados: si el ID canónico preferido (ej. 20) está ocupado por otra entidad histórica, dicha entidad conserva su ID y la escuela faltante se inserta asignando el siguiente ID libre garantizado (`MAX(id) + 1`), sincronizando las secuencias numéricas al finalizar.
   - Si algún caso extremo requiriese una transformación de datos excepcional, queda explícitamente fuera del comando normal de catálogos y documentado como intervención manual; no se ejecuta automáticamente.
2. **Endpoint Público de Lectura de Catálogos y Consumo Dinámico en Frontend**:
   - Creación del endpoint `GET /api/v1/catalogs` (y `GET /api/v1/catalogs/schools`) en [`src/modules/catalogs/`](file:///d:/social_unsch/src/modules/catalogs/), que expone las facultades, escuelas y pabellones con sus **identificadores reales persistidos en base de datos**.
   - Los consumidores de selección y filtrado en frontend ([`RegisterPage`](file:///d:/social_unsch/app/(auth)/register/page.tsx) y [`SettingsPage`](file:///d:/social_unsch/app/(dashboard)/settings/page.tsx)) cargan dinámicamente este catálogo persistido, enviando el ID real (ej. `99`) en el registro y en la actualización de perfil, manteniendo las constantes locales únicamente como fallback de arranque/SSR sin imponer IDs rígidos.
3. **Atomicidad de Solicitudes de Carpooling sin Compensaciones**:
   - Sustitución de compensaciones reactivas (`INSERT` seguido de consulta y posterior `DELETE`) por una transacción PostgreSQL atómica con el mismo cliente dedicado (`BEGIN ... COMMIT / ROLLBACK`).
   - Restricción de duplicados respaldada por índice único (`idx_carpooling_requests_active_unique` / PostgreSQL `23505`), traducida deterministamente a error de negocio HTTP 400 (`ERR_CARPOOLING_DUPLICATE_REQUEST`).
   - Política de ciclo académico canónico: `users.current_academic_cycle` es el campo canónico oficial; si se desconoce, retorna `null` y **nunca inventa el ciclo 1**. Prevalece sobre el dato legacy sin sobreescrituras automáticas.
4. **Adopción de Bases Preexistentes y Validación Estructural**:
   - Función [`validateMigrationStructure`](file:///d:/social_unsch/src/database/migrations/migrator.ts#L67) en el migrador comprueba exhaustivamente tablas, columnas, tipos de datos, restricciones y funciones antes de asentar en `schema_migrations`.
   - Soporte para esquemas heredados sin `schema_migrations`, esquemas parcialmente migrados, interrupción y reanudación segura, y diagnóstico claro ante columnas incompatibles sin borrar datos.
5. **Aclaración y Verificación de Conexión y Bloqueo del Migrador**:
   - El bloqueo consultivo (`pg_try_advisory_lock`) opera a nivel de sesión física de PostgreSQL y requiere una sesión continua durante toda la ejecución.
   - Una **conexión directa** o un **connection pooler en modo sesión (Session Mode)** satisface este requisito.
   - El **número de puerto no prueba por sí solo el modo de conexión**, dado que cualquier proxy puede exponerse en puertos arbitrarios.
   - Un único cliente de `node-postgres` **no resuelve el problema** si detrás opera un pooler en modo transacción (Transaction Mode, como PgBouncer con `pool_mode=transaction`), ya que dicho modo reasigna conexiones físicas entre sentencias y libera inadvertidamente bloqueos de sesión.
   - Se documentó el procedimiento de verificación mediante `SELECT pg_backend_pid()` y prueba de retención de locks.
6. **Validación Positiva del Seed de Demostración**:
   - Reemplazo de listas negras por lista positiva estricta (`ALLOWED_LOCAL_HOSTS`: `localhost`, `127.0.0.1`, `::1`). Bloqueo absoluto ante `NODE_ENV=production` y antes de emitir consultas.
7. **Saneamiento de Helpers de Pruebas**:
   - Eliminación de supresores de error (`pool.on('error', () => {})`) y timeouts con fallo transparente.

### 1.2. Verificado mediante Pruebas
- **Suite de Pruebas Unitarias e Integración Mockeadas**: 19 suites de 19 aprobadas (**380 pruebas pasadas de 380, 100% exitosas**).
  - Cobertura estricta (`npm run test:coverage`):
    - **Statements: 95.46%** (569/596) [Umbral: >= 90%]
    - **Branches: 91.35%** (243/266) [Umbral: >= 90%]
    - **Functions: 97.10%** (67/69) [Umbral: >= 90%]
    - **Lines: 95.59%** (564/590) [Umbral: >= 90%]
- **Suite de Pruebas Reales con Contenedores Docker Aislados** (PostgreSQL 15 en puerto 55432 y Redis 7 en puerto 56379): 5 suites de 5 aprobadas (**33 pruebas reales pasadas de 33, 100% exitosas**).
  - *Catálogos e Identificadores (Escenarios 8 a 11)*:
    1. Escuela con ID distinto a constantes (ej. Sistemas con ID 99): conserva ID 99 y relaciones en `users` y `feed_posts`.
    2. Colisión de ID con entidad previa ocupando ID 20: conserva la entidad previa en ID 20 sin reasignar; inserta Sistemas en un nuevo ID libre sin pisar. Segunda carga es 100% idempotente (0 insertadas, 0 modificadas).
    3. Correspondencia ambigua (conflicto nombre vs código): aborta transaccionalmente con error claro y rollback sin mutaciones parciales.
    4. Consumidor de catálogos obtiene ID real (99) vía `GET /api/v1/catalogs` y lo envía en `POST /api/v1/auth/register`, persistiendo con ID 99 en PostgreSQL.
  - *Carpooling Concurrente y Rollback*: Carrera concurrente de 2 solicitudes simultáneas (1 aceptada, 1 rechazada con 400 `ERR_CARPOOLING_DUPLICATE_REQUEST`). Rollback transaccional real ante fallo inyectado sin registros huérfanos.
  - *Migraciones y Subproceso*: Adopción de esquemas preexistentes, reanudación tras corte, diagnóstico de columna incompatible, concurrencia de advisory locks, allowlist de seeds y ejecución como subproceso con salida 1 ante fallo sintáctico deliberado.
- **Compilación de Código**:
  - Backend: `npm run build` (`tsc -p tsconfig.backend.json`) -> Código de salida 0.
  - Frontend: `npm run build:frontend` (`next build`) -> Código de salida 0 (14 páginas compiladas y optimizadas).

### 1.3. Pendiente de Validación Remota
- **Despliegue Operativo en Base Remota**: Ejecución de migraciones y catálogos sobre Supabase PostgreSQL en ventana de mantenimiento autorizada (Queda explícitamente prohibido ejecutar `db:migrate:all` sobre entornos remotos durante esta etapa local).
- **Verificación de Poolers en la Nube**: Configuración explícita de la cadena de conexión de migraciones en modo sesión directa (Session Mode) y verificación con `SELECT pg_backend_pid()`.
- **Pruebas de Latencia y Concurrencia en Red WAN**.

---

## 2. Hallazgos Confirmados y Correcciones de la Revisión Final

| # | Componente / Flujo | Hallazgo en Revisión | Corrección Implementada | Archivo de Respaldo |
|---|---|---|---|---|
| 1 | `load_catalogs.ts` | Reasignación automática de IDs con temporales negativos contradecía la conservación de IDs preexistentes. | Eliminación de temporales negativos. Conservación incondicional de los IDs existentes. Inserción de faltantes en IDs libres (`MAX(id) + 1`). | [`src/database/migrations/load_catalogs.ts`](file:///d:/social_unsch/src/database/migrations/load_catalogs.ts) |
| 2 | `load_catalogs.ts` | Riesgo de asignaciones erróneas ante nombres o códigos ambiguos. | Validación previa de correspondencias: si hay ambigüedad (nombre apunta a una escuela y código a otra, o múltiples coincidencias), aborto transaccional inmediato con diagnóstico. | [`src/database/migrations/load_catalogs.ts`](file:///d:/social_unsch/src/database/migrations/load_catalogs.ts#L180-L220) |
| 3 | Frontend y Backend | Formularios dependían de constantes con IDs fijos (1..31). Si una base tenía IDs distintos, enviaban IDs cruzados. | Creación del endpoint público `/api/v1/catalogs`. Formularios de registro y configuración consumen dinámicamente los IDs reales persistidos. | [`src/modules/catalogs/catalogs.controller.ts`](file:///d:/social_unsch/src/modules/catalogs/catalogs.controller.ts)<br>[`app/(auth)/register/page.tsx`](file:///d:/social_unsch/app/(auth)/register/page.tsx) |
| 4 | `migrator.ts` | Documentación asumía que el puerto 5432 demostraba modo de sesión y descartaba poolers arbitrariamente. | Aclaración conceptual: la sesión depende del modo (sesión vs transacción), no del puerto. Documentado método de verificación de sesión y alcance de pruebas locales. | [`src/database/migrations/migrator.ts`](file:///d:/social_unsch/src/database/migrations/migrator.ts#L67-L95) |
| 5 | Cobertura Jest | Cobertura de ramas reportada previamente (91.32%) había caído temporalmente a 88.34% por ramas de error añadidas. | Se incorporaron pruebas unitarias para todas las ramas de error en `carpooling` y se ejecutó la medición real en vivo, alcanzando 91.35% de ramas y 95.46% de sentencias. | [`tests/unit/carpooling.service.test.ts`](file:///d:/social_unsch/tests/unit/carpooling.service.test.ts)<br>[`tests/integration/carpooling.routes.test.ts`](file:///d:/social_unsch/tests/integration/carpooling.routes.test.ts) |

---

## 3. Evidencia de Pruebas y Resultados de Cobertura Exactos

### 3.1. Cobertura de Pruebas Unitarias e Integración (`npm run test:coverage`)

Resultados exactos obtenidos de la ejecución en vivo:

```text
=============================== Coverage summary ===============================
Statements   : 95.46% ( 569/596 ) [Gate: >= 90%]  --> APROBADO
Branches     : 91.35% ( 243/266 ) [Gate: >= 90%]  --> APROBADO
Functions    : 97.10% ( 67/69 )   [Gate: >= 90%]  --> APROBADO
Lines        : 95.59% ( 564/590 ) [Gate: >= 90%]  --> APROBADO
================================================================================
Test Suites: 19 passed, 19 total
Tests:       380 passed, 380 total
Snapshots:   0 total
Time:        7.849 s
```

### 3.2. Pruebas Reales con Contenedores Docker (`npm run test:real`)

Resultados exactos de la suite sobre infraestructura real de PostgreSQL y Redis:

```text
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        10.955 s
```

Desglose de suites reales:
- [`tests/real/migrations.real.test.ts`](file:///d:/social_unsch/tests/real/migrations.real.test.ts): **14/14 pasadas**.
  - Conservación estricta de IDs en escuelas existentes y relaciones (Escenario 8).
  - Colisión de ID con entidad previa sin sobrescrituras ni reasignaciones, e idempotencia en segunda carga (Escenario 9).
  - Correspondencia ambigua aborta transaccionalmente sin mutaciones parciales (Escenario 10).
  - Consumidor de catálogo obtiene y envía ID real persistido en registro (Escenario 11).
  - Bloqueo consultivo `pg_try_advisory_lock` previene ejecutores paralelos (Escenario 12).
  - Allowlist positivo de seed demo y conservación de usuarios preexistentes (Escenario 13).
  - Ejecución de migración como subproceso con salida 1 y rollback completo ante fallo (Escenario 14).
- [`tests/real/carpooling.real.test.ts`](file:///d:/social_unsch/tests/real/carpooling.real.test.ts): **7/7 pasadas**.
- [`tests/real/auth.real.test.ts`](file:///d:/social_unsch/tests/real/auth.real.test.ts): **5/5 pasadas**.
- [`tests/real/radar.real.test.ts`](file:///d:/social_unsch/tests/real/radar.real.test.ts): **5/5 pasadas**.
- [`tests/real/feed_matchmaking.real.test.ts`](file:///d:/social_unsch/tests/real/feed_matchmaking.real.test.ts): **2/2 pasadas**.

---

## 4. Comandos de Operación y Procedimientos

| Comando | Propósito | Ámbito |
|---|---|---|
| `npm run db:migrate` | Aplica migraciones DDL idempotentes verificando estructura y registrando en `schema_migrations`. | Local / Staging / Prod |
| `npm run db:catalogs` | Sincroniza catálogos canónicos conservando IDs existentes sin reasignaciones. | Local / Staging / Prod |
| `npm run db:migrate:status` | Diagnostica migraciones aplicadas y pendientes. | Local / Staging / Prod |
| `npm run db:seed:demo` | Carga datos de prueba ficticios (bloqueado en producción y restringido a localhost). | Solo desarrollo local |
| `npm run db:migrate:all` | Orquestador unificado de migraciones y catálogos en entorno seguro. | Local |
| `npm test` | Suite de 19 suites de pruebas unitarias e integración (380 pruebas). | CI/CD / Local |
| `npm run test:coverage` | Verifica umbrales estrictos de cobertura (>= 90% en 4 ejes). | CI/CD / Local |
| `npm run test:real` | Suite de 33 pruebas reales contra PostgreSQL 15 y Redis 7 en Docker. | CI con Docker / Local |
| `npm run build` | Compilación estricta de backend TypeScript. | Producción |
| `npm run build:frontend` | Compilación y empaquetado optimizado de Next.js. | Producción |

---

## 5. Conclusión Fundamentada sobre el Cierre de la Etapa 2

La **Etapa 2 (Estabilización de Migraciones, Autorización y Flujos Existentes)** se encuentra **PLENAMENTE ESTABILIZADA Y VERIFICADA**:

1. **Conservación de Identificadores y Datos**: Se eliminó cualquier mecanismo de reasignación automática de IDs. Los identificadores existentes de facultades y escuelas, así como sus relaciones con usuarios, publicaciones y archivos académicos, permanecen inalterados. La inserción de faltantes respeta los IDs ocupados y las ambigüedades abortan de forma segura.
2. **Consumo Dinámico**: La interfaz de usuario y las rutas de backend consumen los IDs reales persistidos mediante `/api/v1/catalogs`, eliminando la dependencia rígida de enumeraciones estáticas.
3. **Atomicidad SQL Rigurosa**: Las operaciones críticas de carpooling operan bajo transacciones protegidas con bloqueo pesimista y rollbacks garantizados ante desconexión o fallo inyectado.
4. **Claridad Arquitectónica en Conexiones**: Queda documentada la necesidad de sesión continua para bloqueos consultivos, diferenciando el modo de sesión de la simple especificación de puertos, y reconociendo el alcance de pruebas locales.
5. **Calidad y Cobertura Verificadas**: Cobertura superior al 91% en todos los ejes (95.46% statements, 91.35% branches) y 100% de pruebas aprobadas (380 mockeadas + 33 reales con Docker), con compilación limpia en frontend y backend.

**Veredicto**: La **Etapa 2 está lista para su cierre definitivo** y da paso formal a la **Etapa 3 (Separación de Servicios)** una vez autorizada.
