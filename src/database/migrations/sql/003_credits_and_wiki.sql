-- Migración para el Sistema de Créditos Gamificados y Wiki-Banco (Migración 003)

-- 1. Crear tipo ENUM para el estado de los archivos si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_status') THEN
        CREATE TYPE file_status AS ENUM ('FILE_PENDING_REVIEW', 'FILE_PUBLISHED', 'FILE_REJECTED');
    END IF;
END
$$;

-- 2. Asegurar que las tablas maestras y de negocio base existan
CREATE TABLE IF NOT EXISTS academic_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    school_id INTEGER NOT NULL REFERENCES professional_schools(id),
    academic_cycle INTEGER NOT NULL CHECK (academic_cycle BETWEEN 1 AND 10),
    title VARCHAR(200) NOT NULL,
    tags TEXT,
    file_url VARCHAR(500) NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    credit_cost INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
    status file_status NOT NULL DEFAULT 'FILE_PENDING_REVIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Crear tabla file_downloads si no existe
CREATE TABLE IF NOT EXISTS file_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES academic_files(id),
    downloader_id UUID NOT NULL REFERENCES users(id),
    credits_charged INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Modificar tabla users para incorporar la columna de penalización
ALTER TABLE users ADD COLUMN IF NOT EXISTS wiki_credits_penalty INTEGER NOT NULL DEFAULT 0;

-- 5. Ajustar restricción de saldo de créditos para permitir saldo negativo temporal
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credits_balance_check;
ALTER TABLE users ADD CONSTRAINT users_credits_balance_check CHECK (credits_balance >= -wiki_credits_penalty);

-- 6. Crear la tabla de bitácora (ledger) inmutable para créditos wiki_credits_log
CREATE TABLE IF NOT EXISTS wiki_credits_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    file_id UUID REFERENCES academic_files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Trigger de base de datos para la descarga de archivos (UNSCH-401)
CREATE OR REPLACE FUNCTION fn_process_file_download()
RETURNS TRIGGER AS $$
DECLARE
    v_file_cost INTEGER;
    v_owner_id UUID;
    v_buyer_balance INTEGER;
    v_buyer_penalty INTEGER;
    v_sem_start TIMESTAMPTZ;
    v_sem_end TIMESTAMPTZ;
    v_year INTEGER;
    v_month INTEGER;
    v_is_redownload BOOLEAN;
BEGIN
    SELECT credit_cost, owner_id INTO v_file_cost, v_owner_id
    FROM academic_files
    WHERE id = NEW.file_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Archivo académico no encontrado';
    END IF;

    IF v_owner_id = NEW.downloader_id THEN
        NEW.credits_charged := 0;
        RETURN NEW;
    END IF;

    v_year := EXTRACT(YEAR FROM NEW.created_at);
    v_month := EXTRACT(MONTH FROM NEW.created_at);

    IF v_month <= 7 THEN
        v_sem_start := make_timestamptz(v_year, 1, 1, 0, 0, 0, 'America/Lima');
        v_sem_end   := make_timestamptz(v_year, 7, 31, 23, 59, 59, 'America/Lima');
    ELSE
        v_sem_start := make_timestamptz(v_year, 8, 1, 0, 0, 0, 'America/Lima');
        v_sem_end   := make_timestamptz(v_year, 12, 31, 23, 59, 59, 'America/Lima');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM file_downloads
        WHERE file_id = NEW.file_id
          AND downloader_id = NEW.downloader_id
          AND created_at >= v_sem_start
          AND created_at <= v_sem_end
    ) INTO v_is_redownload;

    IF v_is_redownload THEN
        NEW.credits_charged := 0;
        RETURN NEW;
    END IF;

    SELECT credits_balance, wiki_credits_penalty INTO v_buyer_balance, v_buyer_penalty
    FROM users
    WHERE id = NEW.downloader_id
    FOR UPDATE;

    IF v_buyer_balance < v_file_cost THEN
        RAISE EXCEPTION 'Saldo insuficiente de créditos para descargar el archivo';
    END IF;

    NEW.credits_charged := v_file_cost;

    UPDATE users
    SET credits_balance = credits_balance - v_file_cost,
        updated_at = NOW()
    WHERE id = NEW.downloader_id;

    INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
    VALUES (NEW.downloader_id, -v_file_cost, 'FILE_DOWNLOAD_DEBIT', NEW.file_id, NEW.created_at);

    UPDATE users
    SET credits_balance = credits_balance + v_file_cost,
        updated_at = NOW()
    WHERE id = v_owner_id;

    INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
    VALUES (v_owner_id, v_file_cost, 'FILE_DOWNLOAD_CREDIT', NEW.file_id, NEW.created_at);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_file_download ON file_downloads;
CREATE TRIGGER trg_process_file_download
BEFORE INSERT ON file_downloads
FOR EACH ROW
EXECUTE FUNCTION fn_process_file_download();
