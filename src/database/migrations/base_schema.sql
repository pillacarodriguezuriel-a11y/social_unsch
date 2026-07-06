-- Schema Base de Datos Académica SOCIAL-UNSCH

-- Habilitar la extensión para UUID si no está creada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Crear tipos ENUM necesarios
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'alumnus', 'professor', 'administrator');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type') THEN
        CREATE TYPE project_type AS ENUM ('undergraduate_thesis', 'course_project', 'startup', 'study_circle', 'volunteering');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_condition') THEN
        CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'used');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'radar_status') THEN
        CREATE TYPE radar_status AS ENUM ('fluid', 'medium_queue', 'long_queue', 'closed');
    END IF;
END
$$;

-- 2. Crear Tabla de Facultades
CREATE TABLE IF NOT EXISTS faculties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    abbreviation VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Crear Tabla de Escuelas Profesionales
CREATE TABLE IF NOT EXISTS professional_schools (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Crear Tabla de Pabellones
CREATE TABLE IF NOT EXISTS campus_pavilions (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Crear Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    professional_school_id INTEGER REFERENCES professional_schools(id) ON DELETE SET NULL,
    current_academic_cycle INTEGER,
    credits_balance INTEGER NOT NULL DEFAULT 5,
    has_accepted_terms BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_institutional_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@unsch\.edu\.pe$')
);

-- 6. Crear Tabla de Publicaciones del Feed
CREATE TABLE IF NOT EXISTS feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faculty_id INTEGER REFERENCES faculties(id) ON DELETE SET NULL,
    professional_school_id INTEGER REFERENCES professional_schools(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Crear Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_feed_posts_school_created ON feed_posts (professional_school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
