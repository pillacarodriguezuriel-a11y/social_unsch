-- Migración para Sistema de Moderación Automatizada y Carpooling (Ruta Sancristobalina)

-- 1. Modificar tabla users para incorporar campos de contacto y ciclo académico
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_link VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_cycle INTEGER CHECK (academic_cycle BETWEEN 1 AND 10) DEFAULT 1;

-- 2. Modificar tabla feed_posts para incorporar campo de auditoría
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS in_audit_queue BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Crear tipo ENUM para motivos de denuncia de moderación si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
        CREATE TYPE report_reason AS ENUM ('harassment', 'defamation', 'prohibited_sale', 'academic_fraud', 'spam');
    END IF;
END
$$;

-- 4. Crear tabla de reportes de moderación (moderation_reports)
CREATE TABLE IF NOT EXISTS moderation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'resolved')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Crear tabla de bitácora de moderación (moderation_audit_log)
CREATE TABLE IF NOT EXISTS moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(50) NOT NULL DEFAULT 'auto_suppression_trigger',
    report_count_at_action INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Crear la función del trigger para auto-supresión reactiva (UNSCH-501)
CREATE OR REPLACE FUNCTION fn_auto_suppress_reported_post()
RETURNS TRIGGER AS $$
DECLARE
    v_report_count INTEGER;
    v_is_visible BOOLEAN;
BEGIN
    -- Comprobar el estado de visibilidad del post para evitar bucles redundantes
    SELECT is_visible INTO v_is_visible
    FROM feed_posts
    WHERE id = NEW.post_id;

    IF v_is_visible = TRUE THEN
        -- Contar reportes activos del mismo post con el mismo motivo
        SELECT COUNT(*) INTO v_report_count
        FROM moderation_reports
        WHERE post_id = NEW.post_id
          AND reason = NEW.reason
          AND status = 'active';

        -- Si se alcanza exactamente >= 3 reportes, ocultar post
        IF v_report_count >= 3 THEN
            UPDATE feed_posts
            SET is_visible = FALSE,
                in_audit_queue = TRUE,
                updated_at = NOW()
            WHERE id = NEW.post_id;

            -- Registrar en la bitácora inmutable de moderación
            INSERT INTO moderation_audit_log (post_id, action, report_count_at_action)
            VALUES (NEW.post_id, 'auto_hidden', v_report_count);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignar trigger a la tabla moderation_reports
DROP TRIGGER IF EXISTS trg_auto_suppress_reported_post ON moderation_reports;
CREATE TRIGGER trg_auto_suppress_reported_post
AFTER INSERT ON moderation_reports
FOR EACH ROW
EXECUTE FUNCTION fn_auto_suppress_reported_post();

-- 7. Crear tabla de rutas de carpooling (carpooling_routes)
CREATE TABLE IF NOT EXISTS carpooling_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_district VARCHAR(100) NOT NULL,
    destination VARCHAR(150) NOT NULL,
    destination_pavilion_code VARCHAR(5) REFERENCES campus_pavilions(code) ON DELETE SET NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
    price_soles NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    driver_alias VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Crear tabla de solicitudes de asientos (carpooling_requests)
CREATE TABLE IF NOT EXISTS carpooling_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES carpooling_routes(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('SEAT_REQUESTED', 'SEAT_CONFIRMED', 'SEAT_REJECTED')) DEFAULT 'SEAT_REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (route_id, passenger_id)
);
