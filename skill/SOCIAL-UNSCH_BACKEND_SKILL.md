# SOCIAL-UNSCH_BACKEND_SKILL.md

> **Única Fuente de Verdad (Single Source of Truth)** para todos los agentes de IA encargados de desarrollar el backend del sistema SOCIAL-UNSCH.  
> Versión: 1.0.0 | Fecha: 2025 | Dominio: Universidad Nacional de San Cristóbal de Huamanga (UNSCH)

---

## ÍNDICE

1. [Configuración del Stack Tecnológico y Convenciones](#1-configuración-del-stack-tecnológico-y-convenciones)
2. [Modelado de Datos Relacional — PostgreSQL DDL Completo](#2-modelado-de-datos-relacional--postgresql-ddl-completo)
3. [Arquitectura de Caché y Tiempo Real — Redis Layer](#3-arquitectura-de-caché-y-tiempo-real--redis-layer)
4. [Control de Acceso, Seguridad y JWT Contracts](#4-control-de-acceso-seguridad-y-jwt-contracts)
5. [Especificación de Endpoints de la API](#5-especificación-de-endpoints-de-la-api)
6. [Reglas Específicas de Desarrollo para la IA — SDD Compliance](#6-reglas-específicas-de-desarrollo-para-la-ia--sdd-compliance)

---

## 1. Configuración del Stack Tecnológico y Convenciones

### 1.1 Stack Principal

| Capa | Tecnología | Versión Mínima |
|---|---|---|
| Base de Datos Principal | PostgreSQL | 15.x |
| Caché / Tiempo Real | Redis | 7.x |
| Servidor de Aplicación | Node.js (Express) **o** Python (FastAPI) | Node ≥ 20 / Python ≥ 3.11 |
| Autenticación | JWT (RS256) | — |
| ORM / Query Builder | Prisma (Node) **o** SQLAlchemy (Python) | — |

### 1.2 Convenciones de Base de Datos

- Todos los nombres de tablas y columnas en **snake_case** y en **plural** cuando corresponde a entidades.
- Claves primarias: `id BIGSERIAL PRIMARY KEY` en todas las tablas.
- Timestamps obligatorios: `created_at TIMESTAMPTZ DEFAULT NOW()` y `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- Trigger `update_updated_at_column()` aplicado a todas las tablas para mantener `updated_at` sincronizado automáticamente.

### 1.3 Prefijo Universal de la API

```
/api/v1/
```

Todas las rutas del sistema deben estar registradas bajo este prefijo. No existe ningún endpoint expuesto fuera de este namespace.

### 1.4 Formato Estándar de Respuestas de Error

Todos los errores del servidor, de validación y de negocio deben responder en el siguiente formato JSON. Los mensajes deben redactarse en **español peruano neutro**.

```json
{
  "error": true,
  "message": "El correo electrónico no pertenece al dominio institucional de la UNSCH.",
  "code": "ERR_AUTH_INVALID_DOMAIN"
}
```

**Catálogo de códigos de error — prefijos por módulo:**

| Prefijo | Módulo |
|---|---|
| `ERR_AUTH_` | Autenticación y registro |
| `ERR_VALIDATION_` | Validación de campos |
| `ERR_FEED_` | Publicaciones del feed |
| `ERR_MATCH_` | Matchmaking de proyectos |
| `ERR_WIKI_` | Repositorio de archivos |
| `ERR_MOD_` | Moderación y denuncias |
| `ERR_RADAR_` | Motor del Radar del Campus |
| `ERR_SERVER_` | Errores internos del servidor |

### 1.5 Convenciones de Código

- Variables, funciones, nombres de tablas y columnas: **en inglés**.
- Comentarios explicativos en el código y mensajes de error al usuario: **en español peruano neutro**.
- La lógica crítica de validación (enums, dominios de correo, tokens) **nunca** se delega al frontend; se ejecuta de forma redundante en los controladores del backend.

---

## 2. Modelado de Datos Relacional — PostgreSQL DDL Completo

> Ejecutar los bloques en el orden presentado para respetar las dependencias de claves foráneas.

### 2.1 Trigger de Actualización Automática

```sql
-- Función de utilidad: actualiza updated_at en cada modificación de fila
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Tipos ENUM del Sistema

```sql
-- Roles de usuario dentro del ecosistema UNSCH
CREATE TYPE user_role AS ENUM (
  'estudiante',
  'egresado',
  'docente',
  'administrativo'
);

-- Clasificación de proyectos para la plataforma de matchmaking
CREATE TYPE project_type AS ENUM (
  'Tesis de Pregrado',
  'Proyecto de Curso',
  'Startup/Emprendimiento',
  'Círculo de Estudios',
  'Voluntariado'
);

-- Categorías del marketplace universitario
CREATE TYPE marketplace_category AS ENUM (
  'Libros y Apuntes',
  'Material de Laboratorio',
  'Equipos Electrónicos',
  'Arte y Diseño',
  'Servicios Académicos',
  'Otros'
);

-- Motivos válidos de denuncia de contenido
CREATE TYPE report_reason AS ENUM (
  'Contenido inapropiado',
  'Información falsa',
  'Acoso o bullying',
  'Spam o publicidad no autorizada',
  'Discriminación',
  'Otro'
);

-- Estados visibles del comedor universitario (para Redis Radar)
CREATE TYPE comedor_status AS ENUM (
  'Fluido',
  'Cola Media',
  'Cola Larga',
  'Cerrado'
);

-- Estados visibles de rectorado / ventanillas (para Redis Radar)
CREATE TYPE rectorado_status AS ENUM (
  'Ventanilla vacía',
  'Espera de 15 min',
  'Colapsado'
);
```

### 2.3 Tablas Maestras

#### 2.3.1 `faculties` — Facultades

```sql
CREATE TABLE faculties (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL UNIQUE,
  abbreviation  VARCHAR(20)  NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_faculties_updated_at
  BEFORE UPDATE ON faculties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos canónicos: 9 facultades de la UNSCH
INSERT INTO faculties (name, abbreviation) VALUES
  ('Ciencias Agrarias',                                        'FAGRO'),
  ('Ciencias Biológicas',                                      'FCBIO'),
  ('Ciencias de la Educación',                                 'FCEDU'),
  ('Ciencias Económicas, Administrativas y Contables',         'FCEAC'),
  ('Ciencias Jurídicas y Políticas',                           'FCJP'),
  ('Ciencias Químicas, Biológicas, Físicas y Matemáticas',     'FCQBFM'),
  ('Ciencias Sociales',                                        'FCSS'),
  ('Enfermería',                                               'FENF'),
  ('Ingeniería de Minas, Geología y Civil',                    'FIMGC');
```

#### 2.3.2 `professional_schools` — Escuelas Profesionales

```sql
CREATE TABLE professional_schools (
  id          BIGSERIAL PRIMARY KEY,
  faculty_id  BIGINT      NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professional_schools_faculty_id ON professional_schools(faculty_id);

CREATE TRIGGER trg_professional_schools_updated_at
  BEFORE UPDATE ON professional_schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Carreras canónicas mapeadas a sus facultades
INSERT INTO professional_schools (faculty_id, name, code) VALUES
  -- FAGRO
  (1, 'Agronomía',                          'AGR-001'),
  (1, 'Medicina Veterinaria',               'AGR-002'),
  -- FCBIO
  (2, 'Biología',                           'BIO-001'),
  -- FCEDU
  (3, 'Educación Inicial',                  'EDU-001'),
  (3, 'Educación Primaria',                 'EDU-002'),
  (3, 'Educación Secundaria',               'EDU-003'),
  -- FCEAC
  (4, 'Economía',                           'EAC-001'),
  (4, 'Administración de Empresas',         'EAC-002'),
  (4, 'Contabilidad',                       'EAC-003'),
  -- FCJP
  (5, 'Derecho',                            'JUR-001'),
  -- FCQBFM
  (6, 'Química',                            'QBF-001'),
  (6, 'Matemática',                         'QBF-002'),
  (6, 'Física',                             'QBF-003'),
  (6, 'Biología (FCQBFM)',                  'QBF-004'),
  -- FCSS
  (7, 'Antropología Social',                'CSS-001'),
  (7, 'Arqueología',                        'CSS-002'),
  (7, 'Sociología',                         'CSS-003'),
  (7, 'Trabajo Social',                     'CSS-004'),
  -- FENF
  (8, 'Enfermería',                         'ENF-001'),
  -- FIMGC
  (9, 'Ingeniería de Minas',                'IMG-001'),
  (9, 'Ingeniería Geológica',               'IMG-002'),
  (9, 'Ingeniería Civil',                   'IMG-003');
```

#### 2.3.3 `university_campuses` — Sedes Universitarias

```sql
CREATE TABLE university_campuses (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  address     TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_university_campuses_updated_at
  BEFORE UPDATE ON university_campuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO university_campuses (name, address) VALUES
  ('Sede Central — Pampa del Arco', 'Av. Independencia s/n, Ayacucho'),
  ('Sede Periférica — La Bandera',  'Distrito Carmen Alto, Ayacucho'),
  ('Sede La Muyurina',              'Ayacucho');
```

#### 2.3.4 `buildings` — Pabellones

```sql
CREATE TABLE buildings (
  id          BIGSERIAL PRIMARY KEY,
  campus_id   BIGINT       NOT NULL REFERENCES university_campuses(id) ON DELETE CASCADE,
  code        VARCHAR(10)  NOT NULL UNIQUE,  -- Código físico del pabellón
  name        VARCHAR(100),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buildings_campus_id ON buildings(campus_id);

CREATE TRIGGER trg_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Códigos físicos canónicos de pabellones de la UNSCH
INSERT INTO buildings (campus_id, code, name) VALUES
  (1, 'AA', 'Pabellón AA'),
  (1, 'AN', 'Pabellón AN'),
  (1, 'AD', 'Pabellón AD'),
  (1, 'Hs', 'Pabellón Humanidades'),
  (1, 'AB', 'Pabellón AB'),
  (1, 'J',  'Pabellón J'),
  (1, 'E',  'Pabellón E'),
  (1, 'U',  'Pabellón U'),
  (1, 'T',  'Pabellón T'),
  (1, 'O',  'Pabellón O'),
  (1, 'W',  'Pabellón W'),
  (1, 'AR', 'Pabellón AR'),
  (1, 'AU', 'Pabellón AU'),
  (1, 'Y',  'Pabellón Y'),
  (1, 'D',  'Pabellón D');
```

### 2.4 Tabla `users` — Usuarios

```sql
CREATE TABLE users (
  id                    BIGSERIAL PRIMARY KEY,
  full_name             VARCHAR(200)  NOT NULL,
  email                 VARCHAR(254)  NOT NULL UNIQUE
                          CONSTRAINT chk_users_institutional_email
                          CHECK (email ~* '^[A-Za-z0-9._%+\-]+@unsch\.edu\.pe$'),
  password_hash         TEXT          NOT NULL,
  role                  user_role     NOT NULL DEFAULT 'estudiante',
  faculty_id            BIGINT        REFERENCES faculties(id) ON DELETE SET NULL,
  school_id             BIGINT        REFERENCES professional_schools(id) ON DELETE SET NULL,
  cycle                 SMALLINT      CHECK (cycle BETWEEN 1 AND 12),
  academic_credits      INTEGER       NOT NULL DEFAULT 0
                          CONSTRAINT chk_users_non_negative_credits CHECK (academic_credits >= 0),
  avatar_url            TEXT,
  bio                   TEXT,
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  is_verified           BOOLEAN       NOT NULL DEFAULT FALSE,
  email_verified_at     TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Un usuario solo puede pertenecer a escuelas de su facultad
  CONSTRAINT chk_users_school_belongs_to_faculty
    CHECK (school_id IS NULL OR faculty_id IS NOT NULL)
);

CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_faculty_id ON users(faculty_id);
CREATE INDEX idx_users_school_id  ON users(school_id);
CREATE INDEX idx_users_role       ON users(role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.5 Tablas del Negocio

#### 2.5.1 `feed_posts` — Publicaciones del Feed

```sql
CREATE TABLE feed_posts (
  id              BIGSERIAL PRIMARY KEY,
  author_id       BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faculty_id      BIGINT        REFERENCES faculties(id) ON DELETE SET NULL,
  school_id       BIGINT        REFERENCES professional_schools(id) ON DELETE SET NULL,
  content         TEXT          NOT NULL,
  media_urls      TEXT[]        DEFAULT '{}',          -- Arreglo de URLs de adjuntos
  is_visible      BOOLEAN       NOT NULL DEFAULT TRUE,  -- FALSE = ocultado por moderación
  is_pinned       BOOLEAN       NOT NULL DEFAULT FALSE,
  report_count    INTEGER       NOT NULL DEFAULT 0,
  in_audit_queue  BOOLEAN       NOT NULL DEFAULT FALSE, -- TRUE = en cola de revisión administrativa
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_posts_author_id  ON feed_posts(author_id);
CREATE INDEX idx_feed_posts_faculty_id ON feed_posts(faculty_id);
CREATE INDEX idx_feed_posts_school_id  ON feed_posts(school_id);
CREATE INDEX idx_feed_posts_visible    ON feed_posts(is_visible) WHERE is_visible = TRUE;

CREATE TRIGGER trg_feed_posts_updated_at
  BEFORE UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.5.2 `matchmaking_projects` — Proyectos del Matchmaking

```sql
CREATE TABLE matchmaking_projects (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id            BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faculty_id          BIGINT        REFERENCES faculties(id) ON DELETE SET NULL,
  title               VARCHAR(200)  NOT NULL,
  description         TEXT          NOT NULL,
  project_type        project_type  NOT NULL,
  skills_offered      TEXT[]        NOT NULL DEFAULT '{}',  -- Habilidades que el equipo aporta
  skills_needed       TEXT[]        NOT NULL DEFAULT '{}',  -- Habilidades que el equipo busca
  max_members         SMALLINT      NOT NULL DEFAULT 5
                        CONSTRAINT chk_project_max_members CHECK (max_members BETWEEN 1 AND 50),
  current_members     SMALLINT      NOT NULL DEFAULT 1,
  is_open             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matchmaking_projects_owner_id  ON matchmaking_projects(owner_id);
CREATE INDEX idx_matchmaking_projects_faculty_id ON matchmaking_projects(faculty_id);
CREATE INDEX idx_matchmaking_projects_open      ON matchmaking_projects(is_open) WHERE is_open = TRUE;

CREATE TRIGGER trg_matchmaking_projects_updated_at
  BEFORE UPDATE ON matchmaking_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.5.3 `marketplace_articles` — Artículos del Marketplace

```sql
CREATE TABLE marketplace_articles (
  id          BIGSERIAL PRIMARY KEY,
  seller_id   BIGINT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200)         NOT NULL,
  description TEXT,
  category    marketplace_category NOT NULL,
  price       NUMERIC(10, 2)       NOT NULL
                CONSTRAINT chk_marketplace_price CHECK (price >= 0),
  image_urls  TEXT[]               DEFAULT '{}',
  is_sold     BOOLEAN              NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN              NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketplace_articles_seller_id ON marketplace_articles(seller_id);
CREATE INDEX idx_marketplace_articles_category  ON marketplace_articles(category);
CREATE INDEX idx_marketplace_articles_active    ON marketplace_articles(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_marketplace_articles_updated_at
  BEFORE UPDATE ON marketplace_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.5.4 `repository_files` — Archivos del Repositorio Wiki

```sql
CREATE TABLE repository_files (
  id              BIGSERIAL PRIMARY KEY,
  uploader_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faculty_id      BIGINT       REFERENCES faculties(id) ON DELETE SET NULL,
  school_id       BIGINT       REFERENCES professional_schools(id) ON DELETE SET NULL,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  file_url        TEXT         NOT NULL,
  file_size_bytes BIGINT,
  mime_type       VARCHAR(100),
  download_count  INTEGER      NOT NULL DEFAULT 0,
  credit_cost     SMALLINT     NOT NULL DEFAULT 1
                    CONSTRAINT chk_repo_credit_cost CHECK (credit_cost >= 0),
  is_approved     BOOLEAN      NOT NULL DEFAULT FALSE,  -- Aprobación por administrador
  approved_by     BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repository_files_uploader_id ON repository_files(uploader_id);
CREATE INDEX idx_repository_files_faculty_id  ON repository_files(faculty_id);
CREATE INDEX idx_repository_files_approved    ON repository_files(is_approved) WHERE is_approved = TRUE;

CREATE TRIGGER trg_repository_files_updated_at
  BEFORE UPDATE ON repository_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.5.5 `carpooling_routes` — Rutas de Carpooling

```sql
CREATE TABLE carpooling_routes (
  id              BIGSERIAL PRIMARY KEY,
  driver_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin          VARCHAR(200) NOT NULL,
  destination     VARCHAR(200) NOT NULL,
  departure_time  TIMESTAMPTZ  NOT NULL,
  available_seats SMALLINT     NOT NULL
                    CONSTRAINT chk_carpooling_seats CHECK (available_seats BETWEEN 1 AND 8),
  fare            NUMERIC(8, 2)
                    CONSTRAINT chk_carpooling_fare CHECK (fare IS NULL OR fare >= 0),
  notes           TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carpooling_routes_driver_id     ON carpooling_routes(driver_id);
CREATE INDEX idx_carpooling_routes_departure     ON carpooling_routes(departure_time);
CREATE INDEX idx_carpooling_routes_active        ON carpooling_routes(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_carpooling_routes_updated_at
  BEFORE UPDATE ON carpooling_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.5.6 `moderation_reports` — Denuncias de Moderación

```sql
CREATE TABLE moderation_reports (
  id           BIGSERIAL PRIMARY KEY,
  reporter_id  BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id      BIGINT        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  reason       report_reason NOT NULL,
  detail       TEXT,
  is_resolved  BOOLEAN       NOT NULL DEFAULT FALSE,
  resolved_by  BIGINT        REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Un usuario no puede denunciar el mismo post por el mismo motivo más de una vez
  CONSTRAINT uq_moderation_reports_reporter_post_reason
    UNIQUE (reporter_id, post_id, reason)
);

CREATE INDEX idx_moderation_reports_post_id     ON moderation_reports(post_id);
CREATE INDEX idx_moderation_reports_reporter_id ON moderation_reports(reporter_id);
CREATE INDEX idx_moderation_reports_unresolved  ON moderation_reports(is_resolved) WHERE is_resolved = FALSE;

CREATE TRIGGER trg_moderation_reports_updated_at
  BEFORE UPDATE ON moderation_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Arquitectura de Caché y Tiempo Real — Redis Layer

### 3.1 Principios Generales

- **TTL universal:** 900 segundos (15 minutos) para todas las claves del Radar del Campus.
- **Sin persistencia de datos sensibles:** Redis almacena únicamente estados agregados y anónimos.
- **Pub/Sub:** Se usa para notificar a los clientes conectados vía WebSocket cuando el estado de un nodo del Radar cambia.
- **Atomicidad:** Todos los incrementos de contadores y mutaciones de estado se ejecutan usando scripts Lua para garantizar operaciones atómicas y evitar condiciones de carrera.

### 3.2 Nomenclatura de Claves y Estructuras

#### 3.2.1 Radar — Comedor Universitario

```
radar:comedor:status              → String  → Valor: "Fluido" | "Cola Media" | "Cola Larga" | "Cerrado" | "indefinido"
radar:comedor:reports:<status>    → Set     → Miembros: user_id (para evitar reportes duplicados del mismo usuario)
```

**TTL:** `EXPIRE radar:comedor:status 900`

#### 3.2.2 Radar — Rectorado / Ventanillas

```
radar:rectorado:status              → String  → Valor: "Ventanilla vacía" | "Espera de 15 min" | "Colapsado" | "indefinido"
radar:rectorado:reports:<status>    → Set     → Miembros: user_id
```

**TTL:** `EXPIRE radar:rectorado:status 900`

#### 3.2.3 Radar — Biblioteca (4 Pisos)

```
radar:biblioteca:floor:1:occupancy  → String  → Valor: porcentaje entero (0–100) o "indefinido"
radar:biblioteca:floor:2:occupancy  → String
radar:biblioteca:floor:3:occupancy  → String
radar:biblioteca:floor:4:occupancy  → String
radar:biblioteca:floor:<N>:reports  → Hash    → Campo: user_id → Valor: nivel_reportado (entero)
```

**TTL:** `EXPIRE radar:biblioteca:floor:<N>:occupancy 900`

#### 3.2.4 Contadores de Reportes por Nodo

```
radar:comedor:vote_window        → Hash   → Campo: "<status>" → Valor: conteo acumulado en ventana de 15 min
radar:rectorado:vote_window      → Hash   → Campo: "<status>" → Valor: conteo acumulado
radar:biblioteca:floor:<N>:vote  → Hash   → Campo: "<nivel>"  → Valor: conteo acumulado
```

### 3.3 Lógica de Agregación por Crowdsourcing

El estado global de un nodo del Radar **solo se muta** si se cumplen las tres condiciones siguientes de forma simultánea:

**Condición 1 — Mínimo de reportes:** Se requieren al menos **3 reportes distintos** (de 3 usuarios diferentes) para el mismo `<status>` o valor dentro de la ventana de 15 minutos.

**Condición 2 — Sin duplicados por usuario:** El `user_id` del reportante NO debe existir ya en el Set de reportantes para ese estado. Un usuario solo puede contribuir una vez por ventana.

**Condición 3 — Ventana activa:** El TTL del Set de reportantes no debe haber expirado.

**Algoritmo en pseudocódigo (implementar como script Lua en Redis):**

```lua
-- Script Lua para reportar estado del comedor (generalizable a cualquier nodo)
-- KEYS[1] = "radar:comedor:reports:<new_status>"
-- KEYS[2] = "radar:comedor:status"
-- ARGV[1] = user_id
-- ARGV[2] = new_status
-- ARGV[3] = TTL (900)
-- ARGV[4] = threshold (3)

local already_voted = redis.call('SISMEMBER', KEYS[1], ARGV[1])
if already_voted == 1 then
  return {0, "Ya reportaste este estado en la ventana actual"}
end

redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])

local vote_count = redis.call('SCARD', KEYS[1])

if vote_count >= tonumber(ARGV[4]) then
  redis.call('SET', KEYS[2], ARGV[2])
  redis.call('EXPIRE', KEYS[2], ARGV[3])
  return {1, "Estado actualizado"}
end

return {0, "Reporte registrado, esperando más confirmaciones"}
```

**Reversión al estado indefinido:**

Cuando el TTL de `radar:<nodo>:status` expira sin que se hayan registrado nuevos reportes, Redis elimina la clave automáticamente. El backend retornará el estado `"indefinido"` cuando una clave no exista en Redis (`nil` en GET).

### 3.4 Canal Pub/Sub para Actualizaciones en Tiempo Real

```
radar:updates   → Canal general de Pub/Sub
```

**Mensaje publicado al mutar un estado:**

```json
{
  "node": "comedor",
  "new_status": "Cola Media",
  "votes": 4,
  "timestamp": "2025-06-01T14:30:00Z"
}
```

Los clientes WebSocket se suscriben a este canal a través del servidor de aplicación (no directamente a Redis) para recibir actualizaciones en tiempo real.

### 3.5 Otras Claves de Uso General

```
session:blacklist:<jti>           → String  → Valor: "1" → TTL: tiempo restante del JWT (para logout)
rate_limit:user:<user_id>:<route> → String  → Valor: contador → TTL: 60 segundos
```

---

## 4. Control de Acceso, Seguridad y JWT Contracts

### 4.1 Algoritmo de Firma JWT

- **Algoritmo:** `RS256` (RSA Signature with SHA-256).
- **Clave privada:** almacenada como variable de entorno `JWT_PRIVATE_KEY` (nunca en el repositorio).
- **Clave pública:** almacenada como variable de entorno `JWT_PUBLIC_KEY`.
- **Expiración del access token:** 1 hora (`exp: iat + 3600`).
- **Expiración del refresh token:** 7 días, almacenado en cookie HttpOnly Secure.

### 4.2 Payload del JWT

El payload del token firmado debe contener **exactamente** los siguientes campos. No se permiten datos adicionales sensibles en el payload.

```json
{
  "jti": "uuid-v4-único",
  "iat": 1717200000,
  "exp": 1717203600,
  "user_id": 42,
  "role": "estudiante",
  "faculty_id": 3,
  "school_id": 7,
  "cycle": 5
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `jti` | `string` (UUID v4) | Identificador único del token (permite invalidación en blacklist) |
| `iat` | `number` (Unix timestamp) | Fecha de emisión |
| `exp` | `number` (Unix timestamp) | Fecha de expiración |
| `user_id` | `number` (BIGINT) | ID del usuario en la tabla `users` |
| `role` | `string` (user_role enum) | Rol del usuario |
| `faculty_id` | `number` \| `null` | ID de la facultad del usuario |
| `school_id` | `number` \| `null` | ID de la escuela profesional del usuario |
| `cycle` | `number` \| `null` | Ciclo académico actual (1–12) |

### 4.3 Middleware de Autenticación Global

Todo controlador protegido debe pasar por este middleware antes de ejecutar su lógica de negocio.

```
Orden de validación (falla rápida — retorna error al primer fallo):

1. Extraer el header "Authorization: Bearer <token>"
   → Si ausente: 401 ERR_AUTH_TOKEN_MISSING
   
2. Verificar la firma del JWT con JWT_PUBLIC_KEY usando RS256
   → Si firma inválida: 401 ERR_AUTH_INVALID_TOKEN
   
3. Verificar que el campo "exp" no haya vencido
   → Si expirado: 401 ERR_AUTH_TOKEN_EXPIRED
   
4. Consultar en Redis si el "jti" del token está en la blacklist
   → Si en blacklist: 401 ERR_AUTH_TOKEN_REVOKED
   
5. Consultar en la tabla "users" que el usuario exista y que "is_active = TRUE"
   → Si inactivo o no existe: 403 ERR_AUTH_USER_INACTIVE
   
6. Adjuntar el objeto "current_user" al contexto de la solicitud y continuar
```

### 4.4 Decoradores / Guards de Roles

Además del middleware global, las rutas administrativas deben validar el rol explícitamente:

```
@require_role(['administrativo'])   → Solo usuarios con role = 'administrativo'
@require_role(['docente', 'administrativo'])  → Docentes y administrativos
@require_own_resource(param='post_id', model='feed_posts', owner_field='author_id')
  → El usuario autenticado debe ser el propietario del recurso
```

### 4.5 Variables de Entorno Requeridas

```env
# JWT
JWT_PRIVATE_KEY=<clave RSA privada en formato PEM>
JWT_PUBLIC_KEY=<clave RSA pública en formato PEM>

# Base de datos
DATABASE_URL=postgresql://user:password@host:5432/social_unsch

# Redis
REDIS_URL=redis://:password@host:6379/0

# Aplicación
APP_PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://social.unsch.edu.pe
```

---

## 5. Especificación de Endpoints de la API

### 5.1 Módulo de Autenticación — `/api/v1/auth`

#### POST `/api/v1/auth/register`

**Descripción:** Registra un nuevo usuario en el sistema. Solo acepta correos del dominio `@unsch.edu.pe`.

**Request Body:**

```json
{
  "full_name": "Juan Carlos Quispe Huamaní",
  "email": "jquispe@unsch.edu.pe",
  "password": "MiPassword123!",
  "role": "estudiante",
  "faculty_id": 3,
  "school_id": 7,
  "cycle": 4
}
```

**Reglas de Validación (forzadas en el controlador):**

| Campo | Regla |
|---|---|
| `full_name` | Requerido. 3–200 caracteres. Solo letras, espacios y caracteres acentuados. |
| `email` | Requerido. Debe cumplir regex `^[A-Za-z0-9._%+\-]+@unsch\.edu\.pe$`. |
| `password` | Requerido. Mínimo 8 caracteres. Al menos una mayúscula, una minúscula, un número y un símbolo especial. |
| `role` | Requerido. Debe ser uno de los valores del enum `user_role`. |
| `faculty_id` | Requerido si `role = 'estudiante'` o `'docente'`. Debe existir en la tabla `faculties`. |
| `school_id` | Opcional. Si se proporciona, debe pertenecer a `faculty_id`. |
| `cycle` | Requerido si `role = 'estudiante'`. Entero entre 1 y 12. |

**Proceso Backend:**

1. Validar todos los campos según reglas anteriores.
2. Verificar que el email no esté ya registrado (`UNIQUE` constraint).
3. Hashear la contraseña con `bcrypt` (cost factor = 12).
4. Insertar usuario en la tabla `users`.
5. Retornar `201 Created`.

**Response 201:**

```json
{
  "message": "Usuario registrado exitosamente. Por favor verifica tu correo institucional.",
  "user_id": 42
}
```

**Errores posibles:**

```json
{ "error": true, "message": "El correo electrónico ingresado no pertenece al dominio institucional de la UNSCH (@unsch.edu.pe).", "code": "ERR_AUTH_INVALID_DOMAIN" }
{ "error": true, "message": "Este correo electrónico ya se encuentra registrado en el sistema.", "code": "ERR_AUTH_EMAIL_EXISTS" }
{ "error": true, "message": "La contraseña debe tener como mínimo 8 caracteres, una mayúscula, una minúscula, un número y un símbolo especial.", "code": "ERR_VALIDATION_PASSWORD_WEAK" }
{ "error": true, "message": "La escuela profesional seleccionada no pertenece a la facultad indicada.", "code": "ERR_VALIDATION_SCHOOL_FACULTY_MISMATCH" }
```

---

#### POST `/api/v1/auth/login`

**Request Body:**

```json
{
  "email": "jquispe@unsch.edu.pe",
  "password": "MiPassword123!"
}
```

**Proceso Backend:**

1. Verificar que el email cumpla el regex del dominio institucional.
2. Buscar usuario por email. Si no existe: error genérico (no revelar si el email existe).
3. Comparar contraseña con bcrypt.
4. Verificar que `is_active = TRUE`.
5. Generar access token JWT (payload del §4.2) firmado con RS256.
6. Generar refresh token (UUID v4), hashearlo y guardarlo en base de datos.
7. Actualizar `last_login_at`.
8. Retornar access token en body y refresh token en cookie HttpOnly Secure.

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 42,
    "full_name": "Juan Carlos Quispe Huamaní",
    "email": "jquispe@unsch.edu.pe",
    "role": "estudiante",
    "faculty_id": 3,
    "school_id": 7,
    "cycle": 4,
    "academic_credits": 5
  }
}
```

**Errores posibles:**

```json
{ "error": true, "message": "Las credenciales ingresadas son incorrectas.", "code": "ERR_AUTH_INVALID_CREDENTIALS" }
{ "error": true, "message": "Tu cuenta se encuentra desactivada. Contacta al administrador.", "code": "ERR_AUTH_USER_INACTIVE" }
```

---

#### POST `/api/v1/auth/logout`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Proceso Backend:**

1. Extraer el `jti` del token JWT del usuario.
2. Calcular el tiempo restante de vida del token: `TTL = exp - now`.
3. Insertar `jti` en la blacklist de Redis: `SET session:blacklist:<jti> 1 EX <TTL>`.
4. Invalidar el refresh token en base de datos.
5. Retornar `200 OK`.

**Response 200:**

```json
{ "message": "Sesión cerrada correctamente." }
```

---

### 5.2 Módulo Feed — `/api/v1/feed`

#### GET `/api/v1/feed`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Query Parameters:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `faculty_id` | `number` (opcional) | Filtrar por facultad |
| `school_id` | `number` (opcional) | Filtrar por escuela profesional |
| `page` | `number` (opcional, default: 1) | Número de página |
| `limit` | `number` (opcional, default: 20, max: 50) | Posts por página |

**Proceso Backend:**

1. Solo retornar posts donde `is_visible = TRUE`.
2. Aplicar filtros por `faculty_id` y/o `school_id` si se proporcionan.
3. Ordenar por `created_at DESC` (más recientes primero), con posts `is_pinned = TRUE` al inicio.
4. Aplicar paginación con `LIMIT` y `OFFSET`.
5. Los índices en `faculty_id`, `school_id` e `is_visible` garantizan performance.

**Response 200:**

```json
{
  "data": [
    {
      "id": 101,
      "author": { "id": 42, "full_name": "Juan Carlos Quispe Huamaní", "avatar_url": null },
      "content": "¿Alguien más tiene problemas con el aula virtual?",
      "media_urls": [],
      "faculty_id": 3,
      "school_id": 7,
      "is_pinned": false,
      "created_at": "2025-06-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

#### POST `/api/v1/feed`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Request Body:**

```json
{
  "content": "¡Excelente charla de hoy en el pabellón AA!",
  "media_urls": ["https://cdn.unsch.edu.pe/img/123.jpg"],
  "faculty_id": 3,
  "school_id": 7
}
```

**Reglas de Validación:**

| Campo | Regla |
|---|---|
| `content` | Requerido. 1–2000 caracteres. |
| `media_urls` | Opcional. Array de strings. Máximo 5 URLs. Cada URL debe ser HTTPS. |
| `faculty_id` | Opcional. Debe existir en `faculties`. |
| `school_id` | Opcional. Si se proporciona, debe pertenecer a `faculty_id`. |

**Response 201:**

```json
{
  "message": "Publicación creada exitosamente.",
  "post_id": 201
}
```

---

### 5.3 Módulo Matchmaking — `/api/v1/matchmaking`

#### GET `/api/v1/matchmaking/projects`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Query Parameters:** `faculty_id`, `project_type`, `page`, `limit` (análogos al feed).

**Response 200:** Lista paginada de proyectos con `is_open = TRUE`.

---

#### POST `/api/v1/matchmaking/score`

**Descripción:** Calcula el porcentaje de afinidad académica entre un usuario y un proyecto basado en la intersección de habilidades.

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Request Body:**

```json
{
  "project_id": 15,
  "user_skills": ["Python", "Machine Learning", "SQL", "Power BI"]
}
```

**Algoritmo de Cálculo (implementar en el controlador):**

```
1. Obtener el proyecto por project_id (verificar que is_open = TRUE).
2. Extraer skills_offered y skills_needed del proyecto.
3. Normalizar todos los arrays a minúsculas y sin espacios extremos.
4. Calcular intersecciones:
   a. matches_offered = INTERSECCIÓN(user_skills, project.skills_offered)
   b. matches_needed  = INTERSECCIÓN(user_skills, project.skills_needed)
5. Calcular score:
   - Si skills_needed no está vacío:
       score = (|matches_needed| / |skills_needed|) * 100
   - Si skills_needed está vacío:
       score = (|matches_offered| / MAX(|skills_offered|, 1)) * 100
6. Redondear score a 2 decimales.
7. Clasificar afinidad:
   - score >= 75  → "Alta"
   - score >= 40  → "Media"
   - score < 40   → "Baja"
```

**Response 200:**

```json
{
  "project_id": 15,
  "affinity_score": 75.00,
  "affinity_level": "Alta",
  "matched_skills": ["Python", "SQL"],
  "missing_skills": ["React", "Node.js"]
}
```

**Errores posibles:**

```json
{ "error": true, "message": "El proyecto solicitado no existe o ya no está disponible.", "code": "ERR_MATCH_PROJECT_NOT_FOUND" }
{ "error": true, "message": "Debes proporcionar al menos una habilidad para calcular la afinidad.", "code": "ERR_VALIDATION_SKILLS_EMPTY" }
```

---

### 5.4 Módulo Wiki-Files — `/api/v1/wiki-files`

#### GET `/api/v1/wiki-files`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Query Parameters:** `faculty_id`, `school_id`, `page`, `limit`.

Solo retorna archivos con `is_approved = TRUE`.

---

#### POST `/api/v1/wiki-files/upload`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)* | `Content-Type: multipart/form-data`

**Form Fields:**

| Campo | Regla |
|---|---|
| `file` | Requerido. Tipos permitidos: PDF, DOCX, PPTX, XLSX, ZIP. Tamaño máximo: 50 MB. |
| `title` | Requerido. 5–300 caracteres. |
| `description` | Opcional. Máximo 1000 caracteres. |
| `faculty_id` | Requerido. |
| `school_id` | Opcional. |

**Proceso Backend:**

1. Validar tipo MIME y tamaño del archivo en el servidor (no confiar en extensión).
2. Subir el archivo al almacenamiento (S3 o equivalente).
3. Insertar registro en `repository_files` con `is_approved = FALSE`.
4. NO otorgar créditos hasta aprobación administrativa.
5. Retornar `201 Created`.

**Response 201:**

```json
{
  "message": "Archivo subido exitosamente. Está pendiente de revisión por el administrador.",
  "file_id": 88
}
```

---

#### POST `/api/v1/wiki-files/:file_id/download`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Descripción:** Descarga un archivo del repositorio descontando créditos académicos.

**Proceso Backend (transaccional — usar transacción de base de datos):**

```
1. Obtener el archivo por file_id. Verificar que is_approved = TRUE.
2. Verificar que el usuario autenticado no sea el uploader (no tiene sentido cobrar créditos propios).
3. Obtener el saldo de créditos del usuario: SELECT academic_credits FROM users WHERE id = current_user.id.
4. REGLA CRÍTICA: Si academic_credits < credit_cost del archivo → rechazar descarga.
5. Dentro de una transacción:
   a. UPDATE users SET academic_credits = academic_credits - file.credit_cost WHERE id = current_user.id
   b. UPDATE repository_files SET download_count = download_count + 1 WHERE id = file_id
6. Retornar la URL firmada (presigned URL) de acceso temporal al archivo.
```

**Response 200:**

```json
{
  "message": "Descarga autorizada.",
  "download_url": "https://cdn.unsch.edu.pe/files/signed/abc123?expires=1717203600",
  "credits_remaining": 3
}
```

**Errores posibles:**

```json
{ "error": true, "message": "No cuentas con suficientes créditos académicos para descargar este archivo. Sube un documento para obtener créditos.", "code": "ERR_WIKI_INSUFFICIENT_CREDITS" }
{ "error": true, "message": "El archivo solicitado no existe o aún no ha sido aprobado.", "code": "ERR_WIKI_FILE_NOT_AVAILABLE" }
```

---

#### PATCH `/api/v1/wiki-files/:file_id/approve`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida — solo `administrativo`)*

**Descripción:** Un administrador aprueba un documento del repositorio, otorgando créditos al subidor.

**Proceso Backend (transaccional):**

```
1. Verificar que current_user.role = 'administrativo' (guard de rol).
2. Obtener el archivo. Verificar que is_approved = FALSE (no aprobar dos veces).
3. Dentro de una transacción:
   a. UPDATE repository_files SET is_approved = TRUE, approved_by = current_user.id, approved_at = NOW() WHERE id = file_id
   b. UPDATE users SET academic_credits = academic_credits + 2 WHERE id = file.uploader_id
4. Retornar 200 OK.
```

**Response 200:**

```json
{
  "message": "Documento aprobado exitosamente. Se otorgaron 2 créditos académicos al autor.",
  "file_id": 88,
  "uploader_id": 42,
  "credits_awarded": 2
}
```

**Errores posibles:**

```json
{ "error": true, "message": "Este documento ya fue aprobado anteriormente.", "code": "ERR_WIKI_ALREADY_APPROVED" }
{ "error": true, "message": "No tienes permisos para realizar esta acción.", "code": "ERR_AUTH_FORBIDDEN" }
```

---

### 5.5 Módulo de Moderación — `/api/v1/moderation`

#### POST `/api/v1/moderation/report`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Request Body:**

```json
{
  "post_id": 101,
  "reason": "Contenido inapropiado",
  "detail": "La publicación contiene lenguaje ofensivo hacia estudiantes de otra facultad."
}
```

**Reglas de Validación:**

| Campo | Regla |
|---|---|
| `post_id` | Requerido. Debe existir en `feed_posts` con `is_visible = TRUE`. |
| `reason` | Requerido. Debe ser uno de los valores del enum `report_reason`. |
| `detail` | Opcional. Máximo 500 caracteres. |

**Proceso Backend (transaccional):**

```
1. Verificar que el post existe y is_visible = TRUE.
2. Verificar que el usuario no sea el autor del post (no se puede denunciar el propio contenido).
3. Verificar que no exista ya una denuncia de este usuario, para este post y con este mismo motivo
   (constraint UNIQUE: reporter_id + post_id + reason).
4. Insertar el registro en moderation_reports.

5. REGLA AUTOMÁTICA DE MODERACIÓN:
   a. Contar cuántas denuncias existen para este post_id con el mismo reason:
      SELECT COUNT(*) FROM moderation_reports WHERE post_id = $1 AND reason = $2
   b. Si COUNT >= 3:
      - UPDATE feed_posts SET is_visible = FALSE, in_audit_queue = TRUE, report_count = report_count + 1
      - Publicar evento en Redis Pub/Sub canal "moderation:alerts" para notificar a admins.
   c. Si COUNT < 3:
      - UPDATE feed_posts SET report_count = report_count + 1

6. Retornar 201 Created.
```

**Response 201:**

```json
{
  "message": "Tu denuncia fue registrada correctamente. El equipo de moderación la revisará a la brevedad.",
  "report_id": 55
}
```

**Errores posibles:**

```json
{ "error": true, "message": "No puedes denunciar tu propia publicación.", "code": "ERR_MOD_SELF_REPORT" }
{ "error": true, "message": "Ya denunciaste esta publicación por el mismo motivo anteriormente.", "code": "ERR_MOD_DUPLICATE_REPORT" }
{ "error": true, "message": "El motivo de denuncia proporcionado no es válido.", "code": "ERR_VALIDATION_INVALID_REASON" }
{ "error": true, "message": "La publicación que intentas denunciar no existe o ya no está disponible.", "code": "ERR_MOD_POST_NOT_FOUND" }
```

---

### 5.6 Módulo Radar del Campus — `/api/v1/radar`

#### GET `/api/v1/radar/status`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Descripción:** Retorna el estado actual de todos los nodos del Radar del Campus consultando Redis.

**Response 200:**

```json
{
  "comedor": {
    "status": "Cola Media",
    "is_definite": true
  },
  "rectorado": {
    "status": "indefinido",
    "is_definite": false
  },
  "biblioteca": {
    "floor_1": { "occupancy": "indefinido", "is_definite": false },
    "floor_2": { "occupancy": 72, "is_definite": true },
    "floor_3": { "occupancy": 45, "is_definite": true },
    "floor_4": { "occupancy": "indefinido", "is_definite": false }
  }
}
```

---

#### POST `/api/v1/radar/report`

**Headers:** `Authorization: Bearer <token>` *(ruta protegida)*

**Request Body:**

```json
{
  "node": "comedor",
  "status": "Cola Larga"
}
```

**Reglas de Validación:**

| Campo | Regla |
|---|---|
| `node` | Requerido. Uno de: `"comedor"`, `"rectorado"`, `"biblioteca_floor_1"`, `"biblioteca_floor_2"`, `"biblioteca_floor_3"`, `"biblioteca_floor_4"`. |
| `status` | Requerido. Debe ser un valor válido del enum correspondiente al nodo. |

**Proceso Backend:**

1. Validar `node` y `status` contra enums.
2. Ejecutar el script Lua de crowdsourcing (§3.3) en Redis de forma atómica.
3. Si el estado fue mutado, publicar en el canal Pub/Sub `radar:updates`.
4. Retornar el resultado.

**Response 200:**

```json
{
  "message": "Reporte registrado. Estado actualizado a: Cola Larga.",
  "updated": true,
  "current_status": "Cola Larga"
}
```

```json
{
  "message": "Reporte registrado. Se necesitan más confirmaciones para actualizar el estado.",
  "updated": false,
  "votes_current": 2,
  "votes_required": 3
}
```

---

## 6. Reglas Específicas de Desarrollo para la IA — SDD Compliance

Esta sección es de cumplimiento obligatorio para todos los agentes de IA que escriban código del backend de SOCIAL-UNSCH.

### 6.1 Idioma del Código vs. Idioma del Usuario

| Elemento | Idioma |
|---|---|
| Nombres de variables, funciones, clases, métodos | **Inglés** |
| Nombres de tablas PostgreSQL y columnas | **Inglés (snake_case)** |
| Comentarios explicativos dentro del código fuente | **Español peruano neutro** |
| Mensajes de error retornados al usuario final (campo `message`) | **Español peruano neutro** |
| Logs del servidor (stdout/stderr) | **Inglés** |
| Documentación técnica interna | **Español** |

**Ejemplo correcto:**

```javascript
// Verificar que el usuario tiene suficientes créditos para descargar el archivo
const hasEnoughCredits = user.academic_credits >= file.credit_cost;
if (!hasEnoughCredits) {
  return res.status(402).json({
    error: true,
    message: "No cuentas con suficientes créditos académicos para descargar este archivo.",
    code: "ERR_WIKI_INSUFFICIENT_CREDITS"
  });
}
```

### 6.2 Validación Redundante en Controladores

La validación de los siguientes elementos debe ejecutarse **obligatoriamente en el backend**, incluso si el frontend ya los valida:

1. **Dominio institucional del email:** Aplicar regex `^[A-Za-z0-9._%+\-]+@unsch\.edu\.pe$` en cada endpoint que reciba un email.
2. **Valores de enums:** Verificar contra la lista de valores permitidos antes de cualquier operación de base de datos.
3. **Integridad referencial facultad-escuela:** Nunca confiar en que el frontend envíe una combinación válida; siempre consultar la base de datos.
4. **Propiedad de recursos:** Verificar que el usuario autenticado sea el propietario del recurso antes de permitir edición o eliminación.
5. **Créditos académicos:** Verificar el saldo en la base de datos en tiempo real, no usar el valor del JWT o del estado del cliente.

### 6.3 Patrones de Seguridad Obligatorios

- **Bcrypt** con cost factor 12 para almacenamiento de contraseñas. Nunca MD5, SHA1 ni SHA256 directo.
- **Transacciones de base de datos** para toda operación que involucre más de una tabla (créditos, aprobaciones, descargas).
- **Prepared Statements / Parameterized Queries** siempre. Nunca interpolación de strings en SQL.
- **Rate Limiting** en endpoints sensibles: máximo 5 intentos de login por IP en 60 segundos.
- **Validación de tipo MIME** en el servidor para uploads (no confiar en la extensión del archivo).
- **CORS** restringido al dominio `ALLOWED_ORIGINS` del entorno de producción.
- **Headers de seguridad:** `Helmet.js` (Node) o equivalente en FastAPI.
- **Sanitización de inputs de texto libre** para prevenir XSS antes de almacenar en base de datos.

### 6.4 Estructura de Directorios Recomendada

```
src/
├── config/
│   ├── database.js       # Conexión a PostgreSQL
│   ├── redis.js          # Cliente Redis
│   └── jwt.js            # Configuración RS256
├── middlewares/
│   ├── authenticate.js   # Middleware JWT global (§4.3)
│   ├── authorize.js      # Guards de roles
│   └── rateLimiter.js    # Rate limiting
├── modules/
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   └── auth.validators.js
│   ├── feed/
│   ├── matchmaking/
│   ├── wiki-files/
│   ├── moderation/
│   └── radar/
├── shared/
│   ├── errors/           # Clases de error personalizadas
│   ├── utils/            # Helpers reutilizables
│   └── constants/        # Enums espejados del dominio
├── database/
│   ├── migrations/       # Scripts DDL en orden de ejecución
│   └── seeds/            # Datos maestros (facultades, escuelas, pabellones)
└── app.js                # Entry point con prefijo /api/v1/
```

### 6.5 Checklist de Revisión para Cada Endpoint

Antes de dar por completo cualquier endpoint, el agente de IA debe verificar:

- [ ] ¿El endpoint está bajo el prefijo `/api/v1/`?
- [ ] ¿El middleware de autenticación está aplicado si la ruta es protegida?
- [ ] ¿Se valida el email contra el dominio `@unsch.edu.pe` si el endpoint lo recibe?
- [ ] ¿Se validan todos los enums antes de consultar la base de datos?
- [ ] ¿Se usa una transacción de base de datos si hay múltiples escrituras?
- [ ] ¿Los errores retornan el formato estándar `{ error, message, code }`?
- [ ] ¿Los mensajes de error están en español peruano neutro?
- [ ] ¿Los nombres de variables y funciones están en inglés?
- [ ] ¿Se usan prepared statements en todas las consultas SQL?
- [ ] ¿Se verifica el rol del usuario si la ruta es administrativa?

---

*Fin del documento SOCIAL-UNSCH_BACKEND_SKILL.md — Versión 1.0.0*  
*Este archivo es la Única Fuente de Verdad del backend. Cualquier modificación debe versionarse y comunicarse a todos los agentes activos.*
