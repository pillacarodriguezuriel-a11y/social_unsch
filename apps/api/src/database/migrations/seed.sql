-- Seed Data para SOCIAL-UNSCH

-- 1. Insertar Facultades (con prevención de duplicados)
INSERT INTO faculties (name) VALUES
    ('Ingeniería de Minas, Geología y Civil'),
    ('Ciencias Económicas, Administrativas y Contables'),
    ('Ciencias Agrarias'),
    ('Ciencias de la Salud'),
    ('Ciencias Sociales'),
    ('Educación')
ON CONFLICT (name) DO NOTHING;

-- 2. Insertar Escuelas Profesionales
INSERT INTO professional_schools (faculty_id, name) VALUES
    (1, 'Ingeniería de Sistemas'),
    (1, 'Ingeniería Civil'),
    (1, 'Ingeniería de Minas'),
    (2, 'Administración de Empresas')
ON CONFLICT DO NOTHING;

-- 3. Insertar Pabellones del Campus
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
    ('D',  'Pabellón D')
ON CONFLICT (code) DO NOTHING;

-- 4. Insertar Usuarios de Prueba (Contraseña: password123)
-- Hash bcrypt verificado de 'password123' con 12 salt rounds
INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id, credits_balance, has_accepted_terms, phone_number, whatsapp_link, academic_cycle) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Juan Carlos Quispe', 'jquispe@unsch.edu.pe', '$2b$12$PXj9/5rZmC5QVuj5bL6fIebntgivHZiDz7ZFk0OIH7tazIC.2Ace6', 'student', 1, 5, true, '966123456', 'https://wa.me/51966123456', 3),
    ('22222222-2222-2222-2222-222222222222', 'Ana María Huamán', 'ahuaman@unsch.edu.pe', '$2b$12$PXj9/5rZmC5QVuj5bL6fIebntgivHZiDz7ZFk0OIH7tazIC.2Ace6', 'student', 1, 8, true, '988654321', 'https://wa.me/51988654321', 5),
    ('33333333-3333-3333-3333-333333333333', 'Carlos Mendoza', 'cmendoza@unsch.edu.pe', '$2b$12$PXj9/5rZmC5QVuj5bL6fIebntgivHZiDz7ZFk0OIH7tazIC.2Ace6', 'student', 2, 4, true, '944321987', 'https://wa.me/51944321987', 5),
    ('44444444-4444-4444-4444-444444444444', 'Administrador General', 'admin@unsch.edu.pe', '$2b$12$PXj9/5rZmC5QVuj5bL6fIebntgivHZiDz7ZFk0OIH7tazIC.2Ace6', 'administrator', 1, 100, true, '912345678', 'https://wa.me/51912345678', 10)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    has_accepted_terms = EXCLUDED.has_accepted_terms;

-- 5. Insertar Perfiles de Matchmaking de prueba para el Swipe Deck
INSERT INTO matchmaking_profiles (id, user_id, project_type, description, is_visible) VALUES
    ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'undergraduate_thesis', 'Buscando programador front-end en React para culminar el prototipo de tesis sobre redes comunitarias.', true),
    ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'startup', 'Desarrollando app de reparto local en Ayacucho. Requiero apoyo en base de datos PostgreSQL.', true)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Insertar Proyectos de Matchmaking asociados
INSERT INTO matchmaking_projects (id, owner_id, faculty_id, title, description, project_type, skills_offered, skills_needed, max_members, current_members, is_open) VALUES
    ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 1, 'Tesis Redes Comunitarias', 'Investigación sobre enrutamiento inalámbrico en zonas rurales de Ayacucho.', 'undergraduate_thesis', '{"Investigación", "Normas APA", "Redes"}', '{"Python", "SQL", "React"}', 3, 1, true),
    ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 1, 'Delivery Ayacucho Startup', 'Emprendimiento para digitalizar bodegas locales.', 'startup', '{"Modelado de Datos", "Finanzas"}', '{"TypeScript", "React Native", "SQL"}', 5, 2, true)
ON CONFLICT DO NOTHING;
