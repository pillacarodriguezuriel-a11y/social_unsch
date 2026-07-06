-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN CANÓNICA — SOCIAL-UNSCH
-- Alinea la base de datos con SOCIAL-UNSCH_SKILL.md
-- Ejecutar con: npx ts-node src/database/migrations/run_migration.ts
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. Añadir project_type faltantes al ENUM (§5 SKILL)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Añadir 'study_circle' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'project_type' AND e.enumlabel = 'study_circle'
    ) THEN
        ALTER TYPE project_type ADD VALUE 'study_circle';
    END IF;

    -- Añadir 'volunteering' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'project_type' AND e.enumlabel = 'volunteering'
    ) THEN
        ALTER TYPE project_type ADD VALUE 'volunteering';
    END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────
-- 0.1. Limpiar referencias y tablas para inserción limpia
-- ─────────────────────────────────────────────────────────────
UPDATE users SET professional_school_id = NULL;
UPDATE feed_posts SET faculty_id = NULL, professional_school_id = NULL;
UPDATE matchmaking_projects SET faculty_id = NULL;

DELETE FROM professional_schools;
DELETE FROM faculties;

-- ─────────────────────────────────────────────────────────────
-- 1. Facultades Canónicas (9 facultades del SKILL §1)
-- Usamos IDs explícitos para garantizar integridad referencial
-- con las escuelas profesionales
-- ─────────────────────────────────────────────────────────────
INSERT INTO faculties (id, name, abbreviation) VALUES
    (1, 'Ciencias Agrarias',                                   'FCA'),
    (2, 'Ciencias Biológicas',                                 'FCB'),
    (3, 'Ciencias de la Educación',                            'FCE'),
    (4, 'Derecho y Ciencias Políticas',                        'FDCP'),
    (5, 'Ingeniería Química y Metalurgia',                     'FIQM'),
    (6, 'Ciencias de la Salud',                                'FCS'),
    (7, 'Ingeniería de Minas, Geología y Civil',               'FIMGC'),
    (8, 'Ciencias Económicas, Administrativas y Contables',    'FCEAC'),
    (9, 'Ciencias Sociales',                                   'FCSoc')
ON CONFLICT (name) DO UPDATE SET
    abbreviation = EXCLUDED.abbreviation;

-- Sincronizar la secuencia de autoincremento para evitar conflictos
SELECT setval('faculties_id_seq', (SELECT MAX(id) FROM faculties));

-- ─────────────────────────────────────────────────────────────
-- 2. Escuelas Profesionales Canónicas (~31 escuelas del SKILL §1)
-- ─────────────────────────────────────────────────────────────
INSERT INTO professional_schools (id, faculty_id, name, code) VALUES
    -- Facultad 1 — Ciencias Agrarias
    (1,  1, 'Agronomía',                          'AGR'),
    (2,  1, 'Ingeniería Agrícola',                'IAG'),
    (3,  1, 'Medicina Veterinaria',               'MVE'),
    (4,  1, 'Ingeniería Agroforestal',            'IAF'),

    -- Facultad 2 — Ciencias Biológicas
    (5,  2, 'Biología',                           'BIO'),

    -- Facultad 3 — Ciencias de la Educación
    (6,  3, 'Educación Inicial',                  'EDI'),
    (7,  3, 'Educación Primaria',                 'EDP'),
    (8,  3, 'Educación Secundaria',               'EDS'),
    (9,  3, 'Educación Física',                   'EDF'),

    -- Facultad 4 — Derecho y Ciencias Políticas
    (10, 4, 'Derecho',                            'DER'),

    -- Facultad 5 — Ingeniería Química y Metalurgia
    (11, 5, 'Ingeniería Química',                 'IQU'),
    (12, 5, 'Ingeniería en Industrias Alimentarias', 'IIA'),
    (13, 5, 'Ingeniería Agroindustrial',          'IAI'),
    (14, 5, 'Ingeniería Ambiental',               'IAM'),

    -- Facultad 6 — Ciencias de la Salud
    (15, 6, 'Obstetricia',                        'OBS'),
    (16, 6, 'Enfermería',                         'ENF'),
    (17, 6, 'Farmacia y Bioquímica',              'FAR'),
    (18, 6, 'Medicina Humana',                    'MED'),
    (19, 6, 'Psicología',                         'PSI'),

    -- Facultad 7 — Ingeniería de Minas, Geología y Civil
    (20, 7, 'Ingeniería de Sistemas',             'ISI'),
    (21, 7, 'Ingeniería Civil',                   'ICI'),
    (22, 7, 'Ingeniería de Minas',                'IMI'),
    (23, 7, 'Ciencias Físico-Matemáticas',        'CFM'),
    (24, 7, 'Arquitectura',                       'ARQ'),

    -- Facultad 8 — Ciencias Económicas, Administrativas y Contables
    (25, 8, 'Administración de Empresas',         'ADM'),
    (26, 8, 'Contabilidad y Auditoría',           'CON'),
    (27, 8, 'Economía',                           'ECO'),

    -- Facultad 9 — Ciencias Sociales
    (28, 9, 'Arqueología e Historia',             'ARH'),
    (29, 9, 'Ciencias de la Comunicación',        'COM'),
    (30, 9, 'Antropología Social',                'ANT'),
    (31, 9, 'Trabajo Social',                     'TRS')
ON CONFLICT (id) DO UPDATE SET
    name       = EXCLUDED.name,
    faculty_id = EXCLUDED.faculty_id,
    code       = EXCLUDED.code;

SELECT setval('professional_schools_id_seq', (SELECT MAX(id) FROM professional_schools));

-- ─────────────────────────────────────────────────────────────
-- 3. Pabellones con nombres descriptivos reales (§2 SKILL)
-- ─────────────────────────────────────────────────────────────
INSERT INTO campus_pavilions (code, name) VALUES
    ('AA',  'Pabellón AA — Medicina Veterinaria'),
    ('AN',  'Pabellón AN — Ciencias Sociales y Comunicación'),
    ('AD',  'Pabellón AD — Agronomía'),
    ('Hs',  'Pabellón Hs — Ing. Sistemas, Química, Biología, Farmacia'),
    ('AB',  'Pabellón AB — Derecho'),
    ('J',   'Pabellón J — Agronomía, Ing. Agrícola, Biología'),
    ('E',   'Pabellón E — Posgrado / Trabajo Social'),
    ('U',   'Pabellón U — Enfermería'),
    ('T',   'Pabellón T — Obstetricia, Medicina Humana, FISMA'),
    ('O',   'Pabellón O — Educación'),
    ('W',   'Pabellón W — Economía, Contabilidad, Administración'),
    ('AR',  'Pabellón AR — Ingeniería Civil, Arquitectura'),
    ('AU',  'Pabellón AU — Ingeniería de Minas'),
    ('Y',   'Pabellón Y — Laboratorios de Biología'),
    ('D',   'Pabellón D (PAGPA) — Educación Ex-Guamán Poma de Ayala')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name;

-- ─────────────────────────────────────────────────────────────
-- 4. Tabla de Alertas del Campus (§3 CAMPUS_ALERT_TYPE)
-- ─────────────────────────────────────────────────────────────
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
    -- Descripción libre: ej. "Aula 203 Pab. W, Prof. García" o "DNI a nombre de Juan"
    description     TEXT NOT NULL,
    -- Pabellón o zona del campus afectada (ej. 'W', 'AN', 'Biblioteca')
    location        VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    -- Se desactiva automáticamente tras 3 horas (TTL manejado por job o Redis)
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_alerts_active_created
    ON campus_alerts (is_active, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. Actualizar usuarios de prueba con school_ids canónicos
-- ─────────────────────────────────────────────────────────────
-- jquispe → Ingeniería de Sistemas (id=20, faculty_id=7)
UPDATE users SET professional_school_id = 20 WHERE email = 'jquispe@unsch.edu.pe';

-- ahuaman → Ingeniería de Sistemas (id=20)
UPDATE users SET professional_school_id = 20 WHERE email = 'ahuaman@unsch.edu.pe';

-- cmendoza → Ingeniería Civil (id=21)
UPDATE users SET professional_school_id = 21 WHERE email = 'cmendoza@unsch.edu.pe';

-- Actualizar proyectos de matchmaking con faculty_id correcto (Fac. 7)
UPDATE matchmaking_projects SET faculty_id = 7 WHERE owner_id IN (
    SELECT id FROM users WHERE email IN ('jquispe@unsch.edu.pe', 'ahuaman@unsch.edu.pe', 'cmendoza@unsch.edu.pe')
);
