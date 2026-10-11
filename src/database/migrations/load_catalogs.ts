import { Pool } from 'pg';
import { pool } from '../../config/database';
import { FACULTIES, PROFESSIONAL_SCHOOLS } from '../../shared/constants/unsch.constants';

// Mapeo canónico de códigos de escuela profesional según SOCIAL-UNSCH_SKILL §1
export const SCHOOL_CODES: Record<number, string> = {
  1: 'AGR',  2: 'IAG',  3: 'MVE',  4: 'IAF',  5: 'BIO',
  6: 'EDI',  7: 'EDP',  8: 'EDS',  9: 'EDF',  10: 'DER',
  11: 'IQU', 12: 'IIA', 13: 'IAI', 14: 'IAM', 15: 'OBS',
  16: 'ENF', 17: 'FAR', 18: 'MED', 19: 'PSI', 20: 'ISI',
  21: 'ICI', 22: 'IMI', 23: 'CFM', 24: 'ARQ', 25: 'ADM',
  26: 'CON', 27: 'ECO', 28: 'ARH', 29: 'COM', 30: 'ANT',
  31: 'TRS',
};

export const CANONICAL_PAVILIONS = [
  { code: 'AA', name: 'Pabellón AA — Medicina Veterinaria' },
  { code: 'AN', name: 'Pabellón AN — Ciencias Sociales y Comunicación' },
  { code: 'AD', name: 'Pabellón AD — Agronomía' },
  { code: 'Hs', name: 'Pabellón Hs — Ing. Sistemas, Química, Biología, Farmacia' },
  { code: 'AB', name: 'Pabellón AB — Derecho' },
  { code: 'J',  name: 'Pabellón J — Agronomía, Ing. Agrícola, Biología' },
  { code: 'E',  name: 'Pabellón E — Posgrado / Trabajo Social' },
  { code: 'U',  name: 'Pabellón U — Enfermería' },
  { code: 'T',  name: 'Pabellón T — Obstetricia, Medicina Humana, FISMA' },
  { code: 'O',  name: 'Pabellón O — Educación' },
  { code: 'W',  name: 'Pabellón W — Economía, Contabilidad, Administración' },
  { code: 'AR', name: 'Pabellón AR — Ingeniería Civil, Arquitectura' },
  { code: 'AU', name: 'Pabellón AU — Ingeniería de Minas' },
  { code: 'Y',  name: 'Pabellón Y — Laboratorios de Biología' },
  { code: 'D',  name: 'Pabellón D (PAGPA) — Educación Ex-Guamán Poma de Ayala' },
];

export const CANONICAL_ALIASES: Record<string, string> = {
  'ingeniería en sistemas': 'Ingeniería de Sistemas',
  'ing. sistemas': 'Ingeniería de Sistemas',
  'ingenieria de sistemas': 'Ingeniería de Sistemas',
  'derecho y ciencias políticas': 'Derecho',
  'ciencias de la comunicación': 'Ciencias de la Comunicación',
  'comunicación': 'Ciencias de la Comunicación',
  'educación secundaria': 'Educación Secundaria',
  'ed. secundaria': 'Educación Secundaria',
  'educación primaria': 'Educación Primaria',
  'ed. primaria': 'Educación Primaria',
  'educación inicial': 'Educación Inicial',
  'ed. inicial': 'Educación Inicial',
};

export function normalizeSchoolName(name: string): string {
  const clean = name.trim().toLowerCase();
  return CANONICAL_ALIASES[clean] || name.trim();
}

export interface CatalogLoadResult {
  facultiesInserted: number;
  facultiesPreserved: number;
  schoolsInserted: number;
  schoolsPreserved: number;
  pavilionsLoaded: number;
}

/**
 * Carga y sincronización de catálogos canónicos de forma estrictamente NO destructiva.
 * - NUNCA ejecuta DELETE en faculties ni professional_schools.
 * - NUNCA actualiza professional_school_id = NULL en usuarios, publicaciones ni archivos.
 * - Resuelve colisiones de IDs y desalineaciones históricas reasignando a los IDs canónicos
 *   (1..31 para escuelas, 1..9 para facultades) y propagando en cascada hacia las tablas dependientes.
 * - Soporta nombres ambiguos y alias canónicos sin adivinar ni sobreescribir entidades desconocidas.
 */
export async function loadCatalogs(customPool?: Pool): Promise<CatalogLoadResult> {
  const activePool = customPool || pool;
  const client = await activePool.connect();

  let facultiesInserted = 0;
  let facultiesPreserved = 0;
  let schoolsInserted = 0;
  let schoolsPreserved = 0;
  let pavilionsLoaded = 0;

  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────
    // 1. Carga y Sincronización de Facultades
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Facultades...');
    await client.query('ALTER TABLE professional_schools DROP CONSTRAINT IF EXISTS professional_schools_faculty_id_fkey');
    await client.query('ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS feed_posts_faculty_id_fkey');

    const existingFaculties = (
      await client.query<{ id: number; name: string; abbreviation: string | null }>(
        'SELECT id, name, abbreviation FROM faculties'
      )
    ).rows;

    for (const f of FACULTIES) {
      const match = existingFaculties.find(
        (ef) =>
          ef.name.trim().toLowerCase() === f.name.trim().toLowerCase() ||
          ef.abbreviation === f.abbreviation
      );

      if (match) {
        facultiesPreserved++;
        if (match.id !== f.id) {
          // Re-alinear ID si difería del canónico
          const tempId = -(match.id + 100);
          await client.query('UPDATE faculties SET id = $1 WHERE id = $2', [tempId, match.id]);
          await client.query('UPDATE professional_schools SET faculty_id = $1 WHERE faculty_id = $2', [tempId, match.id]);
          await client.query('UPDATE feed_posts SET faculty_id = $1 WHERE faculty_id = $2', [tempId, match.id]);

          await client.query('UPDATE faculties SET id = $1, abbreviation = $2 WHERE id = $3', [f.id, f.abbreviation, tempId]);
          await client.query('UPDATE professional_schools SET faculty_id = $1 WHERE faculty_id = $2', [f.id, tempId]);
          await client.query('UPDATE feed_posts SET faculty_id = $1 WHERE faculty_id = $2', [f.id, tempId]);
        } else {
          await client.query(
            'UPDATE faculties SET abbreviation = COALESCE(abbreviation, $1) WHERE id = $2',
            [f.abbreviation, f.id]
          );
        }
      } else {
        await client.query(
          `INSERT INTO faculties (id, name, abbreviation)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, abbreviation = EXCLUDED.abbreviation`,
          [f.id, f.name, f.abbreviation]
        );
        facultiesInserted++;
      }
    }

    await client.query(
      'ALTER TABLE professional_schools ADD CONSTRAINT professional_schools_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE'
    );
    await client.query(
      'ALTER TABLE feed_posts ADD CONSTRAINT feed_posts_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL'
    );
    await client.query(
      "SELECT setval('faculties_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM faculties), 10))"
    );

    // ─────────────────────────────────────────────────────────────
    // 2. Carga y Sincronización de Escuelas Profesionales
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Escuelas Profesionales...');
    await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_professional_school_id_fkey');
    await client.query('ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS feed_posts_professional_school_id_fkey');

    const hasAcademicFiles = (
      await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_files'"
      )
    ).rows.length > 0;

    if (hasAcademicFiles) {
      await client.query(
        'ALTER TABLE academic_files DROP CONSTRAINT IF EXISTS academic_files_school_id_fkey'
      );
    }

    const existingSchools = (
      await client.query<{ id: number; faculty_id: number; name: string; code: string | null }>(
        'SELECT id, faculty_id, name, code FROM professional_schools'
      )
    ).rows;

    const matchedCanonicalIds = new Set<number>();
    const realignmentPlan: Array<{
      oldId: number;
      canonicalId: number;
      name: string;
      facultyId: number;
      code: string;
    }> = [];
    const unalignedSchools: Array<{ id: number; name: string }> = [];

    for (const es of existingSchools) {
      const normalized = normalizeSchoolName(es.name);
      const canonicalMatch = PROFESSIONAL_SCHOOLS.find(
        (cs) =>
          cs.name.trim().toLowerCase() === normalized.trim().toLowerCase() ||
          (es.code && SCHOOL_CODES[cs.id] === es.code.trim().toUpperCase())
      );

      if (canonicalMatch) {
        matchedCanonicalIds.add(canonicalMatch.id);
        const expectedCode = SCHOOL_CODES[canonicalMatch.id] || es.code || '';
        realignmentPlan.push({
          oldId: es.id,
          canonicalId: canonicalMatch.id,
          name: canonicalMatch.name,
          facultyId: canonicalMatch.faculty_id,
          code: expectedCode,
        });
      } else {
        unalignedSchools.push({ id: es.id, name: es.name });
      }
    }

    // Paso 2a: Cambio temporal a IDs negativos para evitar colisiones primarias durante realineación
    for (const plan of realignmentPlan) {
      if (plan.oldId !== plan.canonicalId) {
        const tempId = -(plan.oldId + 10000);
        await client.query('UPDATE professional_schools SET id = $1 WHERE id = $2', [tempId, plan.oldId]);
        await client.query(
          'UPDATE users SET professional_school_id = $1 WHERE professional_school_id = $2',
          [tempId, plan.oldId]
        );
        await client.query(
          'UPDATE feed_posts SET professional_school_id = $1 WHERE professional_school_id = $2',
          [tempId, plan.oldId]
        );
        if (hasAcademicFiles) {
          await client.query(
            'UPDATE academic_files SET school_id = $1 WHERE school_id = $2',
            [tempId, plan.oldId]
          );
        }
        plan.oldId = tempId;
      }
    }

    // Paso 2b: Asignación de ID canónico definitivo
    for (const plan of realignmentPlan) {
      if (plan.oldId < 0) {
        await client.query(
          'UPDATE professional_schools SET id = $1, faculty_id = $2, name = $3, code = $4 WHERE id = $5',
          [plan.canonicalId, plan.facultyId, plan.name, plan.code, plan.oldId]
        );
        await client.query(
          'UPDATE users SET professional_school_id = $1 WHERE professional_school_id = $2',
          [plan.canonicalId, plan.oldId]
        );
        await client.query(
          'UPDATE feed_posts SET professional_school_id = $1 WHERE professional_school_id = $2',
          [plan.canonicalId, plan.oldId]
        );
        if (hasAcademicFiles) {
          await client.query(
            'UPDATE academic_files SET school_id = $1 WHERE school_id = $2',
            [plan.canonicalId, plan.oldId]
          );
        }
      } else {
        await client.query(
          'UPDATE professional_schools SET faculty_id = $1, name = $2, code = $3 WHERE id = $4',
          [plan.facultyId, plan.name, plan.code, plan.canonicalId]
        );
      }
      schoolsPreserved++;
    }

    // Paso 2c: Inserción de escuelas canónicas faltantes
    for (const cs of PROFESSIONAL_SCHOOLS) {
      if (!matchedCanonicalIds.has(cs.id)) {
        const schoolCode = SCHOOL_CODES[cs.id] || null;
        await client.query(
          `INSERT INTO professional_schools (id, faculty_id, name, code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code`,
          [cs.id, cs.faculty_id, cs.name, schoolCode]
        );
        schoolsInserted++;
      }
    }

    // Paso 2d: Entidades no reconocidas: preservar intactas sin borrar
    for (const unknown of unalignedSchools) {
      console.warn(
        `[Catalogs]: ⚠️ Entidad existente no canónica conservada sin alteración: ID ${unknown.id} ('${unknown.name}')`
      );
    }

    // Re-crear restricciones de clave foránea
    await client.query(
      'ALTER TABLE users ADD CONSTRAINT users_professional_school_id_fkey FOREIGN KEY (professional_school_id) REFERENCES professional_schools(id) ON DELETE SET NULL'
    );
    await client.query(
      'ALTER TABLE feed_posts ADD CONSTRAINT feed_posts_professional_school_id_fkey FOREIGN KEY (professional_school_id) REFERENCES professional_schools(id) ON DELETE SET NULL'
    );
    if (hasAcademicFiles) {
      await client.query(
        'ALTER TABLE academic_files ADD CONSTRAINT academic_files_school_id_fkey FOREIGN KEY (school_id) REFERENCES professional_schools(id) ON DELETE CASCADE'
      );
    }

    await client.query(
      "SELECT setval('professional_schools_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM professional_schools), 50))"
    );

    // ─────────────────────────────────────────────────────────────
    // 3. Carga de Pabellones Canónicos
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Pabellones...');
    for (const p of CANONICAL_PAVILIONS) {
      await client.query(
        `INSERT INTO campus_pavilions (code, name)
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [p.code, p.name]
      );
      pavilionsLoaded++;
    }

    await client.query('COMMIT');
    console.log(
      `[Catalogs]: ✔ Catálogos sincronizados con éxito (Facultades: ${facultiesInserted} nuevas / ${facultiesPreserved} existentes; Escuelas: ${schoolsInserted} nuevas / ${schoolsPreserved} existentes; Pabellones: ${pavilionsLoaded}).`
    );

    return {
      facultiesInserted,
      facultiesPreserved,
      schoolsInserted,
      schoolsPreserved,
      pavilionsLoaded,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Catalogs]: ✘ Error al sincronizar catálogos:', (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}
