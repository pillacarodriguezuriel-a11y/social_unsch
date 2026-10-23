-- Habilitar la extensión para UUID si no está creada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla matchmaking_projects si no existe
CREATE TABLE IF NOT EXISTS matchmaking_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faculty_id INTEGER REFERENCES faculties(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    project_type project_type NOT NULL,
    skills_offered TEXT[] NOT NULL DEFAULT '{}',
    skills_needed TEXT[] NOT NULL DEFAULT '{}',
    max_members SMALLINT NOT NULL DEFAULT 5,
    current_members SMALLINT NOT NULL DEFAULT 1,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla matchmaking_profiles si no existe
CREATE TABLE IF NOT EXISTS matchmaking_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    project_type project_type NOT NULL,
    description TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla matchmaking_interactions si no existe
CREATE TABLE IF NOT EXISTS matchmaking_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_profile_id UUID NOT NULL REFERENCES matchmaking_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chat_channel_id UUID DEFAULT NULL,
    UNIQUE (sender_id, receiver_profile_id)
);
