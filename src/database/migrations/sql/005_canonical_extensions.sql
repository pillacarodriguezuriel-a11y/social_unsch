-- Extensiones Canónicas y Refuerzo de Integridad (Migración 005)

-- 1. Añadir project_type faltantes al ENUM si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'project_type' AND e.enumlabel = 'study_circle'
    ) THEN
        ALTER TYPE project_type ADD VALUE 'study_circle';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'project_type' AND e.enumlabel = 'volunteering'
    ) THEN
        ALTER TYPE project_type ADD VALUE 'volunteering';
    END IF;
END
$$;

-- 2. Crear tipo ENUM y tabla para Alertas del Campus si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campus_alert_type') THEN
        CREATE TYPE campus_alert_type AS ENUM (
            'class_suspended',
            'cultural_event',
            'lost_item_dni',
            'lost_item_keys',
            'lost_item_other'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS campus_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type      campus_alert_type NOT NULL,
    description     TEXT NOT NULL,
    location        VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_alerts_active_created
    ON campus_alerts (is_active, created_at DESC);

-- 3. Verificación e índice único seguro contra solicitudes de carpooling duplicadas activas
-- Cumple con: "Antes de añadir restricciones únicas, detecta posibles duplicados existentes; no los borres automáticamente."
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT route_id, passenger_id
        FROM carpooling_requests
        WHERE status IN ('SEAT_REQUESTED', 'SEAT_CONFIRMED')
        GROUP BY route_id, passenger_id
        HAVING COUNT(*) > 1
    ) sub;

    IF dup_count > 0 THEN
        RAISE NOTICE 'Advertencia de integridad: se detectaron % grupos de solicitudes activas duplicadas en carpooling_requests. Se omite creación de índice único para preservar los datos.', dup_count;
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_active_carpooling_request
            ON carpooling_requests (route_id, passenger_id)
            WHERE status IN ('SEAT_REQUESTED', 'SEAT_CONFIRMED');
    END IF;
END
$$;
