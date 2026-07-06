-- Migración para el Sistema de Créditos Gamificados y Wiki-Banco

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agregar columna status a academic_files si no existe
ALTER TABLE academic_files ADD COLUMN IF NOT EXISTS status file_status NOT NULL DEFAULT 'FILE_PENDING_REVIEW';

-- 3. Crear tabla file_downloads si no existe
CREATE TABLE IF NOT EXISTS file_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES academic_files(id),
    downloader_id UUID NOT NULL REFERENCES users(id),
    credits_charged INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Modificar tabla users para incorporar la columna de penalización
ALTER TABLE users ADD COLUMN IF NOT EXISTS wiki_credits_penalty INTEGER NOT NULL DEFAULT 0;

-- 5. Ajustar restricción de saldo de créditos para permitir saldo negativo temporal
-- basado en la penalización acumulada, permitiendo balance negativo solo por penalizaciones
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credits_balance_check;
ALTER TABLE users ADD CONSTRAINT users_credits_balance_check CHECK (credits_balance >= -wiki_credits_penalty);

-- 6. Crear la tabla de bitácora (ledger) inmutable para créditos wiki_credits_log
CREATE TABLE IF NOT EXISTS wiki_credits_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    file_id UUID REFERENCES academic_files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
    -- Determinar límites del semestre académico activo basado en la fecha de la descarga
    v_year := EXTRACT(YEAR FROM NEW.created_at);
    v_month := EXTRACT(MONTH FROM NEW.created_at);
    
    -- Semestre I: 1 de Marzo al 31 de Julio
    -- Semestre II: 1 de Agosto al 31 de Enero del año siguiente
    IF (v_month >= 3 AND v_month <= 7) THEN
        v_sem_start := MAKE_TIMESTAMPTZ(v_year, 3, 1, 0, 0, 0, 'UTC');
        v_sem_end := MAKE_TIMESTAMPTZ(v_year, 7, 31, 23, 59, 59.999, 'UTC');
    ELSIF (v_month >= 8 OR v_month <= 1) THEN
        IF v_month = 1 THEN
            v_sem_start := MAKE_TIMESTAMPTZ(v_year - 1, 8, 1, 0, 0, 0, 'UTC');
            v_sem_end := MAKE_TIMESTAMPTZ(v_year, 1, 31, 23, 59, 59.999, 'UTC');
        ELSE
            v_sem_start := MAKE_TIMESTAMPTZ(v_year, 8, 1, 0, 0, 0, 'UTC');
            v_sem_end := MAKE_TIMESTAMPTZ(v_year + 1, 1, 31, 23, 59, 59.999, 'UTC');
        END IF;
    ELSE
        -- Febrero: mes vacacional, mapear con semestre II previo por defecto
        v_sem_start := MAKE_TIMESTAMPTZ(v_year - 1, 8, 1, 0, 0, 0, 'UTC');
        v_sem_end := MAKE_TIMESTAMPTZ(v_year, 2, 28, 23, 59, 59.999, 'UTC');
    END IF;

    -- Edge Case 2: Verificar si el usuario ya descargó el archivo en el semestre activo
    SELECT EXISTS (
        SELECT 1
        FROM wiki_credits_log
        WHERE user_id = NEW.downloader_id
          AND file_id = NEW.file_id
          AND reason = 'file_downloaded'
          AND created_at >= v_sem_start
          AND created_at <= v_sem_end
    ) INTO v_is_redownload;

    -- Obtener detalles del archivo a descargar
    SELECT credit_cost, owner_id INTO v_file_cost, v_owner_id
    FROM academic_files
    WHERE id = NEW.file_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Archivo académico no encontrado: %', NEW.file_id;
    END IF;

    -- Bloquear la fila del comprador en users para prevenir condiciones de carrera concurrentes
    SELECT credits_balance, wiki_credits_penalty INTO v_buyer_balance, v_buyer_penalty
    FROM users
    WHERE id = NEW.downloader_id
    FOR UPDATE;

    IF v_buyer_balance IS NULL THEN
        RAISE EXCEPTION 'Usuario comprador no encontrado: %', NEW.downloader_id;
    END IF;

    -- Procesamiento de acuerdo a la verificación de redescarga
    IF v_is_redownload THEN
        -- Autorizar descarga gratuita sin costo
        NEW.credits_charged := 0;
        
        -- Registrar la transacción gratuita en la bitácora
        INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
        VALUES (NEW.downloader_id, 0, 'redownload_free', NEW.file_id, NEW.created_at);
        
    ELSE
        -- Descarga normal con costo de créditos
        IF v_buyer_balance < v_file_cost THEN
            RAISE EXCEPTION 'Saldo insuficiente: el usuario % tiene % créditos y el archivo cuesta %', 
                NEW.downloader_id, v_buyer_balance, v_file_cost;
        END IF;

        -- Descontar créditos del comprador
        UPDATE users
        SET credits_balance = credits_balance - v_file_cost
        WHERE id = NEW.downloader_id;

        -- Abonar +2 créditos al cargador (propietario del archivo)
        UPDATE users
        SET credits_balance = credits_balance + 2
        WHERE id = v_owner_id;

        -- Asignar el costo cobrado al registro de descarga
        NEW.credits_charged := v_file_cost;

        -- Escribir registros inmutables en la bitácora para ambos movimientos
        INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
        VALUES (NEW.downloader_id, -v_file_cost, 'file_downloaded', NEW.file_id, NEW.created_at);

        INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
        VALUES (v_owner_id, 2, 'file_uploaded_reward', NEW.file_id, NEW.created_at);

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger antes de la inserción
DROP TRIGGER IF EXISTS trg_process_file_download ON file_downloads;
CREATE TRIGGER trg_process_file_download
BEFORE INSERT ON file_downloads
FOR EACH ROW
EXECUTE FUNCTION fn_process_file_download();

-- 8. Rutina para penalización por contenido fraudulento (Edge Case 1)
CREATE OR REPLACE FUNCTION fn_penalize_fraudulent_file(p_file_id UUID, p_reason VARCHAR DEFAULT 'penalty_fraudulent_content')
RETURNS VOID AS $$
DECLARE
    v_uploader_id UUID;
BEGIN
    -- Localizar al propietario del archivo fraudulento
    SELECT owner_id INTO v_uploader_id
    FROM academic_files
    WHERE id = p_file_id;

    IF v_uploader_id IS NULL THEN
        RAISE EXCEPTION 'Archivo académico no encontrado para aplicar penalización: %', p_file_id;
    END IF;

    -- Actualizar estado del archivo a REJECTED
    UPDATE academic_files
    SET status = 'FILE_REJECTED'
    WHERE id = p_file_id;

    -- Forcefully restar 2 créditos del balance.
    -- La restricción CHECK permite saldos negativos hasta -wiki_credits_penalty.
    UPDATE users
    SET credits_balance = credits_balance - 2,
        wiki_credits_penalty = wiki_credits_penalty + 2
    WHERE id = v_uploader_id;

    -- Escribir en la bitácora inmutable el débito disciplinario
    INSERT INTO wiki_credits_log (user_id, delta, reason, file_id, created_at)
    VALUES (v_uploader_id, -2, p_reason, p_file_id, now());
END;
$$ LANGUAGE plpgsql;
