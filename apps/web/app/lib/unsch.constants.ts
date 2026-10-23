/**
 * UNSCH CANONICAL CONSTANTS — Frontend
 * Fuente única de verdad para toda la UI de SOCIAL-UNSCH.
 * Refleja estrictamente la taxonomía definida en SOCIAL-UNSCH_SKILL.md
 */

// ─────────────────────────────────────────────
// §1. Estructura Académica Canónica
// ─────────────────────────────────────────────

export interface Faculty {
  id: number;
  name: string;
  abbreviation: string;
}

export interface ProfessionalSchool {
  id: number;
  faculty_id: number;
  name: string;
  /** Pabellón(es) principal(es) del SKILL §2 */
  pavilion_codes: string[];
}

export const FACULTIES: Faculty[] = [
  { id: 1, name: 'Ciencias Agrarias',                                   abbreviation: 'FCA' },
  { id: 2, name: 'Ciencias Biológicas',                                 abbreviation: 'FCB' },
  { id: 3, name: 'Ciencias de la Educación',                            abbreviation: 'FCE' },
  { id: 4, name: 'Derecho y Ciencias Políticas',                        abbreviation: 'FDCP' },
  { id: 5, name: 'Ingeniería Química y Metalurgia',                     abbreviation: 'FIQM' },
  { id: 6, name: 'Ciencias de la Salud',                                abbreviation: 'FCS' },
  { id: 7, name: 'Ingeniería de Minas, Geología y Civil',               abbreviation: 'FIMGC' },
  { id: 8, name: 'Ciencias Económicas, Administrativas y Contables',    abbreviation: 'FCEAC' },
  { id: 9, name: 'Ciencias Sociales',                                   abbreviation: 'FCSoc' },
];

export const PROFESSIONAL_SCHOOLS: ProfessionalSchool[] = [
  // Facultad 1 — Ciencias Agrarias
  { id: 1,  faculty_id: 1, name: 'Agronomía',                          pavilion_codes: ['AD', 'J'] },
  { id: 2,  faculty_id: 1, name: 'Ingeniería Agrícola',                pavilion_codes: ['J'] },
  { id: 3,  faculty_id: 1, name: 'Medicina Veterinaria',               pavilion_codes: ['AA'] },
  { id: 4,  faculty_id: 1, name: 'Ingeniería Agroforestal',            pavilion_codes: ['AD'] },

  // Facultad 2 — Ciencias Biológicas
  { id: 5,  faculty_id: 2, name: 'Biología',                           pavilion_codes: ['Hs', 'J', 'Y'] },

  // Facultad 3 — Ciencias de la Educación
  { id: 6,  faculty_id: 3, name: 'Educación Inicial',                  pavilion_codes: ['O', 'D'] },
  { id: 7,  faculty_id: 3, name: 'Educación Primaria',                 pavilion_codes: ['O', 'D'] },
  { id: 8,  faculty_id: 3, name: 'Educación Secundaria',               pavilion_codes: ['O', 'D'] },
  { id: 9,  faculty_id: 3, name: 'Educación Física',                   pavilion_codes: ['O', 'D'] },

  // Facultad 4 — Derecho y Ciencias Políticas
  { id: 10, faculty_id: 4, name: 'Derecho',                            pavilion_codes: ['AB'] },

  // Facultad 5 — Ingeniería Química y Metalurgia
  { id: 11, faculty_id: 5, name: 'Ingeniería Química',                 pavilion_codes: ['Hs'] },
  { id: 12, faculty_id: 5, name: 'Ingeniería en Industrias Alimentarias', pavilion_codes: ['Hs'] },
  { id: 13, faculty_id: 5, name: 'Ingeniería Agroindustrial',          pavilion_codes: ['Hs'] },
  { id: 14, faculty_id: 5, name: 'Ingeniería Ambiental',               pavilion_codes: ['Hs'] },

  // Facultad 6 — Ciencias de la Salud
  { id: 15, faculty_id: 6, name: 'Obstetricia',                        pavilion_codes: ['T'] },
  { id: 16, faculty_id: 6, name: 'Enfermería',                         pavilion_codes: ['U'] },
  { id: 17, faculty_id: 6, name: 'Farmacia y Bioquímica',              pavilion_codes: ['Hs'] },
  { id: 18, faculty_id: 6, name: 'Medicina Humana',                    pavilion_codes: ['T'] },
  { id: 19, faculty_id: 6, name: 'Psicología',                         pavilion_codes: ['T'] },

  // Facultad 7 — Ingeniería de Minas, Geología y Civil
  { id: 20, faculty_id: 7, name: 'Ingeniería de Sistemas',             pavilion_codes: ['Hs'] },
  { id: 21, faculty_id: 7, name: 'Ingeniería Civil',                   pavilion_codes: ['AR'] },
  { id: 22, faculty_id: 7, name: 'Ingeniería de Minas',                pavilion_codes: ['AU'] },
  { id: 23, faculty_id: 7, name: 'Ciencias Físico-Matemáticas',        pavilion_codes: ['T'] },
  { id: 24, faculty_id: 7, name: 'Arquitectura',                       pavilion_codes: ['AR'] },

  // Facultad 8 — Ciencias Económicas, Administrativas y Contables
  { id: 25, faculty_id: 8, name: 'Administración de Empresas',         pavilion_codes: ['W'] },
  { id: 26, faculty_id: 8, name: 'Contabilidad y Auditoría',           pavilion_codes: ['W'] },
  { id: 27, faculty_id: 8, name: 'Economía',                           pavilion_codes: ['W'] },

  // Facultad 9 — Ciencias Sociales
  { id: 28, faculty_id: 9, name: 'Arqueología e Historia',             pavilion_codes: ['AN'] },
  { id: 29, faculty_id: 9, name: 'Ciencias de la Comunicación',        pavilion_codes: ['AN'] },
  { id: 30, faculty_id: 9, name: 'Antropología Social',                pavilion_codes: ['AN'] },
  { id: 31, faculty_id: 9, name: 'Trabajo Social',                     pavilion_codes: ['AN', 'E'] },
];

/** Índice rápido: school_id → nombre */
export const SCHOOL_NAME_BY_ID: Record<number, string> = Object.fromEntries(
  PROFESSIONAL_SCHOOLS.map((s) => [s.id, s.name])
);

/** Índice rápido: school_id → nombre de la facultad */
export const FACULTY_NAME_BY_SCHOOL_ID: Record<number, string> = Object.fromEntries(
  PROFESSIONAL_SCHOOLS.map((s) => [
    s.id,
    FACULTIES.find((f) => f.id === s.faculty_id)?.name ?? '',
  ])
);

/** Agrupación para selectores `<optgroup>` */
export const SCHOOLS_BY_FACULTY: Array<{
  faculty: Faculty;
  schools: ProfessionalSchool[];
}> = FACULTIES.map((faculty) => ({
  faculty,
  schools: PROFESSIONAL_SCHOOLS.filter((s) => s.faculty_id === faculty.id),
}));


// ─────────────────────────────────────────────
// §2. Geografía y Pabellones del Campus
// ─────────────────────────────────────────────

export interface Pavilion {
  code: string;
  description: string;
  sede: 'ciudad_universitaria' | 'rectorado' | 'residencia' | 'pagpa';
}

export const PAVILIONS: Pavilion[] = [
  { code: 'AA',  description: 'Medicina Veterinaria',                                                              sede: 'ciudad_universitaria' },
  { code: 'AN',  description: 'Arqueología e Historia, Antropología Social, Trabajo Social, Comunicación',         sede: 'ciudad_universitaria' },
  { code: 'AD',  description: 'Agronomía',                                                                         sede: 'ciudad_universitaria' },
  { code: 'Hs',  description: 'Biología, Ing. Química, Ing. de Sistemas, Ind. Alimentarias, Farmacia y Bioquímica', sede: 'ciudad_universitaria' },
  { code: 'AB',  description: 'Derecho',                                                                            sede: 'ciudad_universitaria' },
  { code: 'J',   description: 'Agronomía, Ingeniería Agrícola, Biología',                                          sede: 'ciudad_universitaria' },
  { code: 'E',   description: 'Posgrado / Trabajo Social',                                                          sede: 'ciudad_universitaria' },
  { code: 'U',   description: 'Enfermería',                                                                          sede: 'ciudad_universitaria' },
  { code: 'T',   description: 'Obstetricia · Medicina Humana · Ciencias Físico-Matemáticas (FISMA)',               sede: 'ciudad_universitaria' },
  { code: 'O',   description: 'Educación Secundaria, Primaria, Inicial, Física',                                   sede: 'ciudad_universitaria' },
  { code: 'W',   description: 'Economía, Contabilidad y Auditoría, Administración de Empresas',                    sede: 'ciudad_universitaria' },
  { code: 'AR',  description: 'Ingeniería Civil, Arquitectura',                                                    sede: 'ciudad_universitaria' },
  { code: 'AU',  description: 'Ingeniería de Minas',                                                               sede: 'ciudad_universitaria' },
  { code: 'Y',   description: 'Laboratorios y aulas de Biología',                                                  sede: 'ciudad_universitaria' },
  { code: 'D',   description: 'Educación Secundaria, Primaria, Inicial, Física (Ex-PAGPA Guamán Poma de Ayala)',   sede: 'pagpa' },
];

/** Puntos de entrega del Marketplace — del SKILL §6 FEATURE 5a */
export const MARKETPLACE_DELIVERY_POINTS = [
  { value: 'comedor',           label: 'Comedor Universitario (Residencia)' },
  { value: 'entrada_residencia', label: 'Entrada Residencia Universitaria' },
  { value: 'lozas_deportivas',  label: 'Lozas Deportivas' },
  { value: 'puerta_principal',  label: 'Puerta Principal — Av. Independencia' },
  { value: 'cafetín_central',   label: 'Cafetín Central' },
  { value: 'pabellon_W',        label: 'Pabellón W (Económicas)' },
  { value: 'pabellon_Hs',       label: 'Pabellón Hs (Ingenierías / Ciencias)' },
  { value: 'pabellon_AR',       label: 'Pabellón AR (Civil / Arquitectura)' },
  { value: 'pabellon_AB',       label: 'Pabellón AB (Derecho)' },
  { value: 'pabellon_AA',       label: 'Pabellón AA (Medicina Veterinaria)' },
  { value: 'pabellon_AN',       label: 'Pabellón AN (Sociales / Comunicación)' },
];


// ─────────────────────────────────────────────
// §3. Variables de Estado en Vivo (Redis Enums)
// ─────────────────────────────────────────────

export const COMEDOR_STATUSES = [
  { value: 'fluid',        label: 'Fluido',     color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'medium_queue', label: 'Cola Media', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'long_queue',   label: 'Cola Larga', color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'closed',       label: 'Cerrado',    color: 'bg-neutral-gray/10 text-neutral-gray border-neutral-gray/20' },
] as const;

export const RECTORADO_STATUSES = [
  { value: 'empty_window', label: 'Ventanilla Vacía', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'waiting_15',   label: 'Espera ~15 min',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'collapsed',    label: 'Colapsado',         color: 'bg-primary/10 text-primary border-primary/20' },
] as const;

/** §3 — Niveles canónicos de la Biblioteca Central */
export const LIBRARY_LEVELS = [
  { key: 'floor_1', label: 'Nivel 1 — Sótano' },
  { key: 'floor_2', label: 'Nivel 2 — 1er Piso' },
  { key: 'floor_3', label: 'Nivel 3 — 2do Piso' },
  { key: 'floor_4', label: 'Nivel 4 — 3er Piso' },
] as const;

/** §3 — Tipos de alerta del Campus */
export const CAMPUS_ALERT_TYPES = [
  { value: 'class_suspended',  label: 'Clase suspendida',           emoji: '📣', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'cultural_event',   label: 'Evento cultural',            emoji: '🎭', color: 'bg-violet-50 text-violet-800 border-violet-200' },
  { value: 'lost_item_dni',    label: 'Pérdida de DNI',             emoji: '🪪', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'lost_item_keys',   label: 'Pérdida de Llaves',          emoji: '🔑', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'lost_item_other',  label: 'Pérdida de objeto (otro)',   emoji: '📦', color: 'bg-blue-50 text-blue-800 border-blue-200' },
] as const;

export type CampusAlertType = typeof CAMPUS_ALERT_TYPES[number]['value'];


// ─────────────────────────────────────────────
// §4. Catálogo Cerrado de Habilidades / Tags
// ─────────────────────────────────────────────

export interface SkillArea {
  area: string;
  tags: string[];
}

export const SKILL_CATALOG: SkillArea[] = [
  {
    area: 'Ingenierías y Ciencias Exactas',
    tags: [
      'Python', 'C++', 'AutoCAD', 'Topografía', 'Civil 3D',
      'ArcGIS/QGIS', 'MATLAB', 'Gestión de Proyectos',
      'Análisis de Suelos', 'Diseño Arquitectónico',
    ],
  },
  {
    area: 'Ciencias de la Salud y Biológicas',
    tags: [
      'Inyectoterapia', 'Primeros Auxilios', 'Redacción de Historias Clínicas',
      'Procesamiento de Muestras', 'Seguridad Alimentaria',
      'Manejo de Especies', 'Análisis Clínico',
    ],
  },
  {
    area: 'Sociales, Derecho y Educación',
    tags: [
      'Normas APA', 'Oratoria/Debate', 'Litigación Oral',
      'Trabajo de Campo', 'Idioma Quechua', 'Diseño Curricular', 'Psicopedagogía',
    ],
  },
  {
    area: 'Económicas y Gestión',
    tags: [
      'Excel Avanzado', 'SPSS/Stata', 'Finanzas Personales',
      'Marketing Digital', 'Constitución de Empresas',
      'Formulación de Proyectos de Inversión',
    ],
  },
];

/** Lista plana de todos los tags del catálogo para búsqueda/validación */
export const ALL_SKILL_TAGS: string[] = SKILL_CATALOG.flatMap((a) => a.tags);


// ─────────────────────────────────────────────
// §5. Tipos de Proyecto (Matchmaking)
// ─────────────────────────────────────────────

export const PROJECT_TYPES = [
  { value: 'undergraduate_thesis', label: 'Tesis de Pregrado' },
  { value: 'course_project',       label: 'Proyecto de Curso' },
  { value: 'startup',              label: 'Startup / Emprendimiento' },
  { value: 'study_circle',         label: 'Círculo de Estudios' },
  { value: 'volunteering',         label: 'Voluntariado' },
] as const;

export type ProjectTypeValue = typeof PROJECT_TYPES[number]['value'];

export const PROJECT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_TYPES.map((p) => [p.value, p.label])
);


// ─────────────────────────────────────────────
// §6 FEATURE 6 — Motivos de Moderación
// ─────────────────────────────────────────────

export const MODERATION_REASONS = [
  { value: 'harassment',         label: 'Acoso o Bullying' },
  { value: 'misinformation',     label: 'Información Falsa / Difamación' },
  { value: 'spam_political',     label: 'Contenido Político / Spam' },
  { value: 'prohibited_sale',    label: 'Venta Prohibida' },
  { value: 'hate_speech',        label: 'Lenguaje de Odio' },
] as const;


// ─────────────────────────────────────────────
// §6 FEATURE 5d — Carpooling: Distritos de Origen
// ─────────────────────────────────────────────

export const CARPOOLING_DISTRICTS = [
  'San Juan Bautista',
  'Carmen Alto',
  'Jesús Nazareno',
  'Ayacucho (Centro Histórico)',
  'Andrés Avelino Cáceres (Wari)',
  'Magdalena',
  'Quinua',
] as const;


// ─────────────────────────────────────────────
// Roles de usuario canónicos
// ─────────────────────────────────────────────

export const USER_ROLES = [
  { value: 'student',       label: 'Estudiante Regular' },
  { value: 'alumnus',       label: 'Egresado' },
  { value: 'professor',     label: 'Docente' },
  { value: 'administrator', label: 'Administrativo' },
] as const;

export const USER_ROLE_LABEL: Record<string, string> = Object.fromEntries(
  USER_ROLES.map((r) => [r.value, r.label])
);

/** Formato canónico de ciclo académico: YYYY-I o YYYY-II */
export const ACADEMIC_CYCLES = [
  '2025-II', '2026-I', '2026-II',
];
