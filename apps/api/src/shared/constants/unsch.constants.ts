/**
 * UNSCH CANONICAL CONSTANTS — Backend
 * Fuente única de verdad para el backend de SOCIAL-UNSCH.
 * Refleja estrictamente la taxonomía definida en SOCIAL-UNSCH_SKILL.md
 * Usado en validaciones Zod, migraciones y seeding.
 */

// ─────────────────────────────────────────────
// §1. Estructura Académica Canónica
// ─────────────────────────────────────────────

export const FACULTIES = [
  { id: 1, name: 'Ciencias Agrarias',                                   abbreviation: 'FCA' },
  { id: 2, name: 'Ciencias Biológicas',                                 abbreviation: 'FCB' },
  { id: 3, name: 'Ciencias de la Educación',                            abbreviation: 'FCE' },
  { id: 4, name: 'Derecho y Ciencias Políticas',                        abbreviation: 'FDCP' },
  { id: 5, name: 'Ingeniería Química y Metalurgia',                     abbreviation: 'FIQM' },
  { id: 6, name: 'Ciencias de la Salud',                                abbreviation: 'FCS' },
  { id: 7, name: 'Ingeniería de Minas, Geología y Civil',               abbreviation: 'FIMGC' },
  { id: 8, name: 'Ciencias Económicas, Administrativas y Contables',    abbreviation: 'FCEAC' },
  { id: 9, name: 'Ciencias Sociales',                                   abbreviation: 'FCSoc' },
] as const;

export const FACULTY_IDS = FACULTIES.map((f) => f.id);

export const PROFESSIONAL_SCHOOLS = [
  // Facultad 1 — Ciencias Agrarias
  { id: 1,  faculty_id: 1, name: 'Agronomía' },
  { id: 2,  faculty_id: 1, name: 'Ingeniería Agrícola' },
  { id: 3,  faculty_id: 1, name: 'Medicina Veterinaria' },
  { id: 4,  faculty_id: 1, name: 'Ingeniería Agroforestal' },
  // Facultad 2 — Ciencias Biológicas
  { id: 5,  faculty_id: 2, name: 'Biología' },
  // Facultad 3 — Ciencias de la Educación
  { id: 6,  faculty_id: 3, name: 'Educación Inicial' },
  { id: 7,  faculty_id: 3, name: 'Educación Primaria' },
  { id: 8,  faculty_id: 3, name: 'Educación Secundaria' },
  { id: 9,  faculty_id: 3, name: 'Educación Física' },
  // Facultad 4 — Derecho y Ciencias Políticas
  { id: 10, faculty_id: 4, name: 'Derecho' },
  // Facultad 5 — Ingeniería Química y Metalurgia
  { id: 11, faculty_id: 5, name: 'Ingeniería Química' },
  { id: 12, faculty_id: 5, name: 'Ingeniería en Industrias Alimentarias' },
  { id: 13, faculty_id: 5, name: 'Ingeniería Agroindustrial' },
  { id: 14, faculty_id: 5, name: 'Ingeniería Ambiental' },
  // Facultad 6 — Ciencias de la Salud
  { id: 15, faculty_id: 6, name: 'Obstetricia' },
  { id: 16, faculty_id: 6, name: 'Enfermería' },
  { id: 17, faculty_id: 6, name: 'Farmacia y Bioquímica' },
  { id: 18, faculty_id: 6, name: 'Medicina Humana' },
  { id: 19, faculty_id: 6, name: 'Psicología' },
  // Facultad 7 — Ingeniería de Minas, Geología y Civil
  { id: 20, faculty_id: 7, name: 'Ingeniería de Sistemas' },
  { id: 21, faculty_id: 7, name: 'Ingeniería Civil' },
  { id: 22, faculty_id: 7, name: 'Ingeniería de Minas' },
  { id: 23, faculty_id: 7, name: 'Ciencias Físico-Matemáticas' },
  { id: 24, faculty_id: 7, name: 'Arquitectura' },
  // Facultad 8 — Ciencias Económicas, Administrativas y Contables
  { id: 25, faculty_id: 8, name: 'Administración de Empresas' },
  { id: 26, faculty_id: 8, name: 'Contabilidad y Auditoría' },
  { id: 27, faculty_id: 8, name: 'Economía' },
  // Facultad 9 — Ciencias Sociales
  { id: 28, faculty_id: 9, name: 'Arqueología e Historia' },
  { id: 29, faculty_id: 9, name: 'Ciencias de la Comunicación' },
  { id: 30, faculty_id: 9, name: 'Antropología Social' },
  { id: 31, faculty_id: 9, name: 'Trabajo Social' },
] as const;

export const VALID_SCHOOL_IDS = PROFESSIONAL_SCHOOLS.map((s) => s.id);
export const SCHOOL_NAME_BY_ID: Record<number, string> = Object.fromEntries(
  PROFESSIONAL_SCHOOLS.map((s) => [s.id, s.name])
);


// ─────────────────────────────────────────────
// §2. Pabellones del Campus
// ─────────────────────────────────────────────

export const PAVILION_CODES = [
  'AA', 'AN', 'AD', 'Hs', 'AB', 'J', 'E', 'U', 'T', 'O', 'W', 'AR', 'AU', 'Y', 'D',
] as const;

export const PAVILION_MAP: Record<string, string> = {
  AA:  'Pab. AA — Medicina Veterinaria',
  AN:  'Pab. AN — Ciencias Sociales y Comunicación',
  AD:  'Pab. AD — Agronomía',
  Hs:  'Pab. Hs — Ing. Sistemas, Química, Biología, Farmacia',
  AB:  'Pab. AB — Derecho',
  J:   'Pab. J — Agronomía, Ing. Agrícola, Biología',
  E:   'Pab. E — Posgrado / Trabajo Social',
  U:   'Pab. U — Enfermería',
  T:   'Pab. T — Obstetricia, Medicina, FISMA',
  O:   'Pab. O — Educación',
  W:   'Pab. W — Economía, Contabilidad, Administración',
  AR:  'Pab. AR — Ing. Civil, Arquitectura',
  AU:  'Pab. AU — Ingeniería de Minas',
  Y:   'Pab. Y — Laboratorios de Biología',
  D:   'Pab. D (PAGPA) — Educación (Ex-Guamán Poma)',
};


// ─────────────────────────────────────────────
// §3. Variables de Estado en Vivo (Redis Enums)
// ─────────────────────────────────────────────

/** TTL del estado de radar en segundos (15 minutos) */
export const RADAR_TTL_SECONDS = 900;

/** Mínimo de reportes coincidentes para confirmar un estado */
export const RADAR_VOTE_THRESHOLD = 3;

export const COMEDOR_STATUS_VALUES = ['fluid', 'medium_queue', 'long_queue', 'closed'] as const;
export type ComedorStatus = typeof COMEDOR_STATUS_VALUES[number];

export const RECTORADO_STATUS_VALUES = ['empty_window', 'waiting_15', 'collapsed'] as const;
export type RectoradoStatus = typeof RECTORADO_STATUS_VALUES[number];

/** Niveles canónicos de la Biblioteca Central */
export const LIBRARY_LEVELS = {
  floor_1: 'Nivel 1 — Sótano',
  floor_2: 'Nivel 2 — 1er Piso',
  floor_3: 'Nivel 3 — 2do Piso',
  floor_4: 'Nivel 4 — 3er Piso',
} as const;

/** Tipos de alerta del campus — §3 CAMPUS_ALERT_TYPE */
export const CAMPUS_ALERT_TYPE_VALUES = [
  'class_suspended',
  'cultural_event',
  'lost_item_dni',
  'lost_item_keys',
  'lost_item_other',
] as const;
export type CampusAlertType = typeof CAMPUS_ALERT_TYPE_VALUES[number];

export const CAMPUS_ALERT_TYPE_LABELS: Record<CampusAlertType, string> = {
  class_suspended:  'Clase suspendida',
  cultural_event:   'Evento cultural',
  lost_item_dni:    'Pérdida de DNI',
  lost_item_keys:   'Pérdida de Llaves',
  lost_item_other:  'Pérdida de objeto (otro)',
};


// ─────────────────────────────────────────────
// §4. Catálogo de Habilidades / Tags (Lista Cerrada)
// ─────────────────────────────────────────────

export const SKILL_CATALOG_TAGS = [
  // Ingenierías y Ciencias Exactas
  'Python', 'C++', 'AutoCAD', 'Topografía', 'Civil 3D', 'ArcGIS/QGIS',
  'MATLAB', 'Gestión de Proyectos', 'Análisis de Suelos', 'Diseño Arquitectónico',
  // Ciencias de la Salud y Biológicas
  'Inyectoterapia', 'Primeros Auxilios', 'Redacción de Historias Clínicas',
  'Procesamiento de Muestras', 'Seguridad Alimentaria', 'Manejo de Especies', 'Análisis Clínico',
  // Sociales, Derecho y Educación
  'Normas APA', 'Oratoria/Debate', 'Litigación Oral', 'Trabajo de Campo',
  'Idioma Quechua', 'Diseño Curricular', 'Psicopedagogía',
  // Económicas y Gestión
  'Excel Avanzado', 'SPSS/Stata', 'Finanzas Personales', 'Marketing Digital',
  'Constitución de Empresas', 'Formulación de Proyectos de Inversión',
] as const;

export type SkillTag = typeof SKILL_CATALOG_TAGS[number];


// ─────────────────────────────────────────────
// §5. Tipos de Proyecto (Matchmaking)
// ─────────────────────────────────────────────

export const PROJECT_TYPE_VALUES = [
  'undergraduate_thesis',
  'course_project',
  'startup',
  'study_circle',
  'volunteering',
] as const;

export type ProjectType = typeof PROJECT_TYPE_VALUES[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  undergraduate_thesis: 'Tesis de Pregrado',
  course_project:       'Proyecto de Curso',
  startup:              'Startup / Emprendimiento',
  study_circle:         'Círculo de Estudios',
  volunteering:         'Voluntariado',
};


// ─────────────────────────────────────────────
// §6. Motivos de Moderación
// ─────────────────────────────────────────────

export const MODERATION_REASONS = [
  'harassment',
  'misinformation',
  'spam_political',
  'prohibited_sale',
  'hate_speech',
] as const;

export type ModerationReason = typeof MODERATION_REASONS[number];

/** Threshold automático de supresión de posts */
export const MODERATION_AUTO_SUPPRESS_THRESHOLD = 3;


// ─────────────────────────────────────────────
// Roles de usuario
// ─────────────────────────────────────────────

export const USER_ROLE_VALUES = ['student', 'alumnus', 'professor', 'administrator'] as const;
export type UserRole = typeof USER_ROLE_VALUES[number];
