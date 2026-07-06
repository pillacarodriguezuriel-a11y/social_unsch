---
name: social-unsch-database
description: Especificación técnica única (Single Source of Truth) para la capa de datos del sistema "SOCIAL-UNSCH" — PostgreSQL como persistencia relacional y Redis como caché/agregación en tiempo real. Usar esta skill SIEMPRE que se escriban scripts DDL, migraciones, funciones PL/pgSQL, triggers, índices, o estructuras de Redis para SOCIAL-UNSCH, o cuando se mencione "credits_balance", "academic_files", "feed_posts", "Campus Radar", "Wiki-Banco de Archivos", "marketplace_items", "matchmaking_profiles", "carpooling_routes", o cualquier tabla/enum de este proyecto. Aplica tanto si se está creando un esquema nuevo desde cero, como si se está optimizando una query existente, depurando un trigger, o extendiendo el modelo de datos. Consultar esta skill antes de definir cualquier tabla, tipo ENUM, restricción CHECK, índice, función PL/pgSQL o key de Redis dentro de este proyecto.
---

# SOCIAL-UNSCH — Database Architecture & Data Integrity Skill

Esta skill encapsula el rol de **Administrador de Base de Datos Principal (Lead DBA) y Arquitecto de Datos** especializado en PostgreSQL y Redis Enterprise para "SOCIAL-UNSCH". Es la **Única Fuente de Verdad** que deben consultar todos los agentes de IA antes de escribir DDL, migraciones, queries, triggers o configuraciones de Redis.

**Regla de oro:** ante cualquier ambigüedad de modelado no contemplada explícitamente aquí, prioriza siempre integridad referencial y consistencia transaccional sobre conveniencia de escritura rápida. Si una operación puede dejar el balance de créditos o la visibilidad de contenido en un estado inconsistente por una condición de carrera, debe resolverse a nivel de base de datos (constraint, trigger, o transacción explícita), nunca delegarse "por confianza" a la capa de aplicación.

---

## Cómo usar esta skill

1. Antes de escribir cualquier DDL, identifica en qué sección cae la tarea (convenciones globales, tipos, catálogos, tablas core, triggers, índices, o Redis).
2. Los nombres de tablas/columnas, tipos ENUM y restricciones de esta skill son **normativos** — no se renombran ni se relajan sin justificación explícita del usuario.
3. Toda tabla nueva que no esté contemplada aquí debe seguir las convenciones de la Sección 1 (snake_case, plural, UUID v4, TIMESTAMPTZ) antes que inventar un patrón distinto.
4. Cualquier operación que modifique `credits_balance` o `is_visible` debe pasar por una función/trigger transaccional (Sección 5), nunca por un UPDATE directo sin validación desde la capa de aplicación.

---

## 1. Arquitectura de Datos y Convenciones Globales

- **Motores:**
  - **PostgreSQL** — persistencia relacional, transaccional, ACID. Fuente de verdad para todo dato de negocio.
  - **Redis** — caché en memoria y agregaciones de tiempo real con TTL. Nunca es fuente de verdad permanente; es un estado derivado y expirable.
- **Convenciones de nomenclatura (obligatorias, sin excepción):**
  - Todo en minúsculas: tablas, columnas, índices, vistas, funciones.
  - `snake_case` siempre (nunca camelCase ni PascalCase en SQL).
  - Nombres de tablas en **plural**: `users`, `academic_files`, `marketplace_items`.
- **Tipos de llaves:**
  - `UUID` (v4) como Primary Key **mandatorio** para todo registro de negocio expuesto vía API (usuarios, posts, archivos, items, reportes, etc.).
  - `SERIAL`/`BIGSERIAL` reservado **únicamente** para tablas maestras estáticas internas (catálogos cerrados de la Sección 3) que no se exponen como recurso editable de la API.
- **Zona horaria:**
  - Todo timestamp se almacena como `TIMESTAMP WITH TIME ZONE` (`TIMESTAMPTZ`).
  - El motor fuerza UTC; nunca se almacena hora local sin zona.

---

## 2. Tipos de Datos Personalizados y ENUMs (Dominio UNSCH)

Estos tipos deben crearse con `CREATE TYPE ... AS ENUM` antes de cualquier tabla que los referencie. Son cerrados por diseño — un cambio de valores requiere una migración explícita (`ALTER TYPE ... ADD VALUE`), nunca un campo `VARCHAR` libre disfrazado de enum.

```sql
CREATE TYPE user_role AS ENUM (
    'student',
    'alumnus',
    'professor',
    'administrator'
);

CREATE TYPE project_type AS ENUM (
    'undergraduate_thesis',
    'course_project',
    'startup',
    'study_circle',
    'volunteering'
);

CREATE TYPE item_condition AS ENUM (
    'new',
    'like_new',
    'used'
);

CREATE TYPE report_reason AS ENUM (
    'harassment',
    'defamation',
    'prohibited_sale',
    'academic_fraud',
    'spam'
);

CREATE TYPE radar_status AS ENUM (
    'fluid',
    'medium_queue',
    'long_queue',
    'closed'
);
```

---

## 3. Esquema de Tablas Maestras (Catálogos Cerrados)

Tablas estructurales de la universidad. Usan `SERIAL`/`BIGSERIAL` por ser catálogos internos estáticos (ver Sección 1).

```sql
CREATE TABLE faculties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE professional_schools (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES faculties(id),
    name VARCHAR(150) NOT NULL
);

CREATE TABLE campus_pavilions (
    code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(150) NOT NULL
);
```

**Seed data — `faculties` (ejemplo representativo, extender según facultades reales de la UNSCH):**

```sql
INSERT INTO faculties (name) VALUES
    ('Ingeniería de Minas, Geología y Civil'),
    ('Ciencias Económicas, Administrativas y Contables'),
    ('Ciencias Agrarias'),
    ('Ciencias de la Salud'),
    ('Ciencias Sociales'),
    ('Educación');
```

**Seed data — `professional_schools` (ejemplo):**

```sql
INSERT INTO professional_schools (faculty_id, name) VALUES
    (1, 'Ingeniería de Sistemas'),
    (1, 'Ingeniería Civil'),
    (1, 'Ingeniería de Minas');
```

**Seed data — `campus_pavilions` (códigos físicos del campus):**

```sql
INSERT INTO campus_pavilions (code, name) VALUES
    ('AA', 'Pabellón AA'),
    ('AN', 'Pabellón AN'),
    ('AD', 'Pabellón AD'),
    ('Hs', 'Pabellón Hs'),
    ('AB', 'Pabellón AB'),
    ('J',  'Pabellón J'),
    ('E',  'Pabellón E'),
    ('U',  'Pabellón U'),
    ('T',  'Pabellón T'),
    ('O',  'Pabellón O'),
    ('W',  'Pabellón W'),
    ('AR', 'Pabellón AR'),
    ('AU', 'Pabellón AU'),
    ('Y',  'Pabellón Y'),
    ('D',  'Pabellón D');
```

> Nota: los nombres descriptivos exactos de cada pabellón ("Pabellón W", etc.) deben completarse con la nomenclatura oficial real de la UNSCH cuando esté disponible; los códigos (`AA`, `AN`, ... `D`) son fijos y no deben alterarse.

---

## 4. Modelado de Tablas Core y Restricciones Avanzadas (DDL)

### 4.1 `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@unsch\.edu\.pe$'),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    school_id INTEGER REFERENCES professional_schools(id),
    credits_balance INTEGER NOT NULL DEFAULT 0
        CHECK (credits_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- El `CHECK` de `email` es la **única** vía de entrada válida: cualquier dominio distinto a `@unsch.edu.pe` debe ser rechazado a nivel de motor, no solo en el frontend (ver skill de frontend, Sección 4.1 — esa es solo la capa de UX; esta es la garantía real).
- `credits_balance >= 0` es la defensa de última línea contra condiciones de carrera en descuentos concurrentes (ver Sección 5.2 sobre por qué esto no basta por sí solo y se requiere transacción explícita).

### 4.2 `feed_posts`

```sql
CREATE TABLE feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    faculty_id INTEGER REFERENCES faculties(id),
    school_id INTEGER REFERENCES professional_schools(id),
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 `academic_files`

```sql
CREATE TABLE academic_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    school_id INTEGER NOT NULL REFERENCES professional_schools(id),
    academic_cycle INTEGER NOT NULL CHECK (academic_cycle BETWEEN 1 AND 10),
    title VARCHAR(200) NOT NULL,
    tags TEXT,
    file_url VARCHAR(500) NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    credit_cost INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.4 Tablas de negocio restantes

```sql
CREATE TABLE marketplace_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2),
    is_barter BOOLEAN NOT NULL DEFAULT FALSE,
    condition item_condition NOT NULL,
    delivery_pavilion_code VARCHAR(5) REFERENCES campus_pavilions(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matchmaking_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    project_type project_type NOT NULL,
    description TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carpooling_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id),
    origin_district VARCHAR(100) NOT NULL,
    destination_pavilion_code VARCHAR(5) REFERENCES campus_pavilions(code),
    departure_time TIMESTAMPTZ NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. Triggers y Funciones de Integridad Automática (Stored Procedures)

### 5.1 Auto-supresión de posts por denuncias acumuladas

Requiere primero la tabla `reports` y una tabla de auditoría:

```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES feed_posts(id),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reason report_reason NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES feed_posts(id),
    action VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(50) NOT NULL DEFAULT 'auto_suppression_trigger',
    report_count_at_action INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_auto_suppress_reported_post()
RETURNS TRIGGER AS $$
DECLARE
    v_report_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_report_count
    FROM reports
    WHERE post_id = NEW.post_id;

    IF v_report_count >= 3 THEN
        UPDATE feed_posts
        SET is_visible = FALSE,
            updated_at = now()
        WHERE id = NEW.post_id
          AND is_visible = TRUE;

        INSERT INTO moderation_audit_log (post_id, action, report_count_at_action)
        VALUES (NEW.post_id, 'auto_hidden', v_report_count);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_suppress_reported_post
AFTER INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION fn_auto_suppress_reported_post();
```

- El `UPDATE ... WHERE is_visible = TRUE` evita re-disparar el log de auditoría infinitamente si el post ya fue ocultado y sigue recibiendo denuncias.
- El umbral `>= 3` es el valor de negocio aprobado; si cambia, se actualiza solo en esta función (single source of truth del comportamiento).

### 5.2 Trigger transaccional de descarga en Wiki-Banco

```sql
CREATE TABLE file_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES academic_files(id),
    downloader_id UUID NOT NULL REFERENCES users(id),
    credits_charged INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_process_file_download()
RETURNS TRIGGER AS $$
DECLARE
    v_file_cost INTEGER;
    v_owner_id UUID;
    v_buyer_balance INTEGER;
BEGIN
    SELECT credit_cost, owner_id INTO v_file_cost, v_owner_id
    FROM academic_files
    WHERE id = NEW.file_id
    FOR UPDATE;

    SELECT credits_balance INTO v_buyer_balance
    FROM users
    WHERE id = NEW.downloader_id
    FOR UPDATE;

    IF v_buyer_balance < v_file_cost THEN
        RAISE EXCEPTION
            'Saldo insuficiente: el usuario % tiene % créditos y el archivo cuesta %',
            NEW.downloader_id, v_buyer_balance, v_file_cost;
    END IF;

    UPDATE users
    SET credits_balance = credits_balance - v_file_cost
    WHERE id = NEW.downloader_id;

    UPDATE users
    SET credits_balance = credits_balance + 2
    WHERE id = v_owner_id;

    NEW.credits_charged := v_file_cost;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_process_file_download
BEFORE INSERT ON file_downloads
FOR EACH ROW
EXECUTE FUNCTION fn_process_file_download();
```

- `FOR UPDATE` en ambas lecturas (archivo y comprador) bloquea las filas relevantes dentro de la transacción, evitando que dos descargas concurrentes lean el mismo balance "viejo" y produzcan un saldo incorrecto — esta es la razón por la que el `CHECK (credits_balance >= 0)` de la Sección 4.1 no es suficiente por sí solo: protege contra el resultado final negativo, pero no contra la condición de carrera que lo produce.
- Es `BEFORE INSERT`, no `AFTER`, porque el trigger necesita poder abortar la inserción (`RAISE EXCEPTION`) antes de que `file_downloads` registre una descarga que nunca se cobró.
- El abono de `+2` créditos al propietario es fijo según especificación; si se vuelve configurable, debe migrarse a una columna o tabla de configuración, no quedar hardcodeado en múltiples lugares.

---

## 6. Estrategia de Indexación y Rendimiento (Indexing Plan)

```sql
-- Acelera la carga del feed de inicio filtrado por facultad/escuela, ordenado por recencia
CREATE INDEX idx_feed_posts_faculty_school_created
    ON feed_posts (faculty_id, school_id, created_at DESC);

-- Búsqueda de texto completo en Marketplace
CREATE INDEX idx_marketplace_items_fulltext
    ON marketplace_items
    USING GIN (to_tsvector('spanish', title || ' ' || coalesce(description, '')));

-- Búsqueda de texto completo en Wiki-Banco de Archivos
CREATE INDEX idx_academic_files_fulltext
    ON academic_files
    USING GIN (to_tsvector('spanish', title || ' ' || coalesce(tags, '')));
```

- Se usa el diccionario `'spanish'` de PostgreSQL para `to_tsvector`, dado que todo el contenido textual del sistema es en español.
- Estos índices GIN deben revisarse (`REINDEX` o `VACUUM ANALYZE` periódico) si el volumen de `marketplace_items`/`academic_files` crece rápido, ya que los índices de texto completo se degradan más que un B-Tree estándar bajo escritura intensiva.

---

## 7. Modelado de la Capa In-Memory (Redis Schemas)

TTL obligatorio de **900 segundos (15 minutos)** en toda key de estado del Campus Radar — ningún estado de tráfico debe persistir indefinidamente sin una nueva confirmación de usuarios.

### 7.1 Estructura de keys

**`radar:comedor:status`** (Hash):

```
HSET radar:comedor:status
    status        "fluid"          # valor del enum radar_status
    report_count  "0"              # reportes acumulados en la ventana actual
    last_updated  "1719072000"     # epoch timestamp de la última actualización
EXPIRE radar:comedor:status 900
```

**`radar:biblioteca:floor:[1-4]:occupancy`** (Hash, una key por piso):

```
HSET radar:biblioteca:floor:1:occupancy
    status        "medium_queue"
    report_count  "2"
    last_updated  "1719072000"
EXPIRE radar:biblioteca:floor:1:occupancy 900
```

> El patrón `radar:biblioteca:floor:[1-4]:occupancy` genera 4 keys independientes (`floor:1`, `floor:2`, `floor:3`, `floor:4`), no una sola key con un campo de piso — esto permite expirar/consultar cada piso de forma aislada.

### 7.2 Lógica de backend (crowdsourcing de confirmaciones)

1. Al recibir un reporte de un usuario sobre un nodo del radar (ej. comedor o un piso de biblioteca), el backend incrementa una estructura temporal de conteo en Redis, asociada a ese nodo y a una ventana de tiempo (los mismos 15 minutos).
2. Cada reporte debe registrarse de forma que se pueda deduplicar por usuario/IP dentro de la ventana — un mismo usuario reportando varias veces no debe contar como múltiples confirmaciones independientes.
3. Cuando se acumulan **3 reportes concordantes** de usuarios/IPs distintas dentro de los 15 minutos, el backend actualiza el campo `status` de la Hash principal del nodo (ej. `radar:comedor:status`) al nuevo valor de `radar_status`, resetea `report_count` y actualiza `last_updated`.
4. Si no se alcanza el umbral de 3 reportes concordantes antes de que expire el TTL de 900 segundos, la key completa expira y el nodo vuelve a un estado "sin datos recientes" hasta el siguiente reporte — esto es intencional: evita que un estado de tráfico viejo se muestre como verdad vigente indefinidamente.

---

## Checklist rápido antes de entregar cualquier script DDL o función

- [ ] ¿Tablas/columnas en `snake_case`, tablas en plural, todo en minúsculas?
- [ ] ¿PK es `UUID v4` (registro de negocio) o `SERIAL`/`BIGSERIAL` (catálogo estático), nunca mezclado?
- [ ] ¿Todo timestamp es `TIMESTAMPTZ`, nunca `TIMESTAMP` sin zona?
- [ ] ¿Los ENUMs usados ya existen en la Sección 2, o se está creando un `VARCHAR` libre que debería ser ENUM?
- [ ] ¿Cualquier modificación a `credits_balance` ocurre dentro de una transacción con bloqueo (`FOR UPDATE`), no como un `UPDATE` suelto desde la app?
- [ ] ¿Cualquier cambio a `is_visible` por moderación pasa por el trigger de auditoría (Sección 5.1), o queda sin rastro?
- [ ] ¿Las búsquedas por texto en Marketplace/Wiki-Files usan los índices GIN existentes en vez de un `LIKE '%...%'` sin índice?
- [ ] ¿Toda key de Redis del Campus Radar tiene `EXPIRE` de 900 segundos explícito?
