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

export interface CatalogLoadResult {
  facultiesInserted: number;
  facultiesPreserved: number;
  schoolsInserted: number;
  schoolsPreserved: number;
  pavilionsLoaded: number;
}

/**
 * Carga de catálogos canónicos de forma estrictamente NO destructiva e idempotente.
 * - NUNCA ejecuta DELETE en faculties ni professional_schools.
 * - NUNCA actualiza professional_school_id = NULL en usuarios ni feed_posts.
 * - Preserva IDs existentes y relaciones de clave foránea intactas.
 * - Si una entidad ya existe, conserva su ID y actualiza metadatos secundarios.
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
    // 1. Carga de Facultades (Preservando IDs y asociaciones)
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Facultades...');
    const facultyMap = new Map<number, number>(); // ID canónico -> ID real en DB

    for (const f of FACULTIES) {
      // Buscar por nombre exacto (clave natural)
      const existingByName = await client.query<{ id: number; name: string }>(
        'SELECT id, name FROM faculties WHERE name = $1',
        [f.name]
      );

      if (existingByName.rows.length > 0) {
        const dbId = existingByName.rows[0].id;
        facultyMap.set(f.id, dbId);
        facultiesPreserved++;
        // Actualizar abreviatura si estaba ausente
        await client.query(
          'UPDATE faculties SET abbreviation = COALESCE(abbreviation, $1) WHERE id = $2',
          [f.abbreviation, dbId]
        );
      } else {
        // Verificar si el ID canónico está libre
        const existingById = await client.query<{ id: number; name: string }>(
          'SELECT id, name FROM faculties WHERE id = $1',
          [f.id]
        );

        if (existingById.rows.length === 0) {
          // El ID canónico está disponible: insertar con ID explícito
          await client.query(
            'INSERT INTO faculties (id, name, abbreviation) VALUES ($1, $2, $3)',
            [f.id, f.name, f.abbreviation]
          );
          facultyMap.set(f.id, f.id);
          facultiesInserted++;
        } else {
          // El ID está ocupado por otra facultad (caso de base previa con desalineación)
          // Insertamos dejando que la secuencia genere el ID para no colisionar
          const insertRes = await client.query<{ id: number }>(
            'INSERT INTO faculties (name, abbreviation) VALUES ($1, $2) RETURNING id',
            [f.name, f.abbreviation]
          );
          facultyMap.set(f.id, insertRes.rows[0].id);
          facultiesInserted++;
        }
      }
    }

    // Sincronizar secuencia de autoincremento de faculties
    await client.query(
      "SELECT setval('faculties_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM faculties), 1))"
    );

    // ─────────────────────────────────────────────────────────────
    // 2. Carga de Escuelas Profesionales (Preservando integridad referencial)
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Escuelas Profesionales...');

    for (const s of PROFESSIONAL_SCHOOLS) {
      const targetFacultyId = facultyMap.get(s.faculty_id) || s.faculty_id;
      const schoolCode = SCHOOL_CODES[s.id] || null;

      // Buscar si la escuela ya existe por nombre dentro de la facultad
      const existingByName = await client.query<{ id: number; code: string | null }>(
        'SELECT id, code FROM professional_schools WHERE name = $1 AND faculty_id = $2',
        [s.name, targetFacultyId]
      );

      if (existingByName.rows.length > 0) {
        const dbId = existingByName.rows[0].id;
        schoolsPreserved++;
        // Actualizar código si falta
        if (schoolCode && !existingByName.rows[0].code) {
          await client.query(
            'UPDATE professional_schools SET code = $1 WHERE id = $2',
            [schoolCode, dbId]
          );
        }
      } else {
        // Verificar si el ID canónico está libre
        const existingById = await client.query<{ id: number }>(
          'SELECT id FROM professional_schools WHERE id = $1',
          [s.id]
        );

        if (existingById.rows.length === 0) {
          await client.query(
            'INSERT INTO professional_schools (id, faculty_id, name, code) VALUES ($1, $2, $3, $4)',
            [s.id, targetFacultyId, s.name, schoolCode]
          );
          schoolsInserted++;
        } else {
          // ID ocupado por otra escuela: insertar con serial
          await client.query(
            'INSERT INTO professional_schools (faculty_id, name, code) VALUES ($1, $2, $3)',
            [targetFacultyId, s.name, schoolCode]
          );
          schoolsInserted++;
        }
      }
    }

    // Sincronizar secuencia de autoincremento de professional_schools
    await client.query(
      "SELECT setval('professional_schools_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM professional_schools), 1))"
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
