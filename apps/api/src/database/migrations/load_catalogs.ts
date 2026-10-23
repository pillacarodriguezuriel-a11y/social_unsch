import { Pool, PoolClient } from 'pg';
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
  /** Mapa explícito: ID canónico de facultad → ID real persistido. */
  facultyIdMap: Record<number, number>;
  /** Mapa explícito: ID canónico de escuela → ID real persistido. */
  schoolIdMap: Record<number, number>;
}

/**
 * Sincroniza la secuencia de una tabla de catálogo para que el siguiente nextval()
 * devuelva MAX(id) + 1. Se ejecuta con la tabla bloqueada (ver loadCatalogs).
 */
async function syncIdSequence(
  client: PoolClient,
  table: 'faculties' | 'professional_schools'
): Promise<void> {
  await client.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
  );
}

/**
 * Carga y sincronización de catálogos canónicos conservando estrictamente los IDs existentes.
 * 
 * Principios de diseño:
 * 1. Conservación estricta de IDs: NUNCA se ejecutan UPDATEs sobre claves primarias ni IDs negativos temporales.
 * 2. Resolución inequívoca por claves naturales: búsqueda por nombre normalizado o código.
 * 3. Detección y aborto transaccional ante correspondencias ambiguas: si una entidad coincide
 *    con múltiples escuelas canónicas o si nombre y código apuntan a entidades distintas, se aborta con error claro.
 * 4. Inserción de entidades faltantes sin colisiones: si el ID canónico preferido ya está ocupado
 *    por otra entidad existente, se inserta respetando la secuencia sin sobreescribir ni despojar el ID existente.
 * 5. Preservación absoluta de relaciones existentes de usuarios, publicaciones y archivos académicos.
 * 6. Mapa explícito canónico → real: las escuelas nuevas se asocian a la facultad real resuelta
 *    (por nombre o por abreviatura). Si no puede resolverse, se aborta en lugar de usar el ID canónico.
 * 7. Concurrencia: las tablas de catálogo se bloquean en modo SHARE ROW EXCLUSIVE durante la
 *    transacción. Dos cargas simultáneas se serializan; las lecturas y las comprobaciones de claves
 *    foráneas no se bloquean. Los IDs alternativos los asigna la secuencia, sincronizada bajo el bloqueo.
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
    // Serializa cargas concurrentes y bloquea escrituras ajenas sobre los catálogos mientras se
    // calculan IDs. SELECT y las comprobaciones de claves foráneas siguen permitidas.
    await client.query(
      'LOCK TABLE faculties, professional_schools IN SHARE ROW EXCLUSIVE MODE'
    );
    const facultyIdMap = new Map<number, number>();
    const schoolIdMap = new Map<number, number>();

    // ─────────────────────────────────────────────────────────────
    // 1. Carga y Sincronización de Facultades (Conservando IDs existentes)
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Facultades conservando IDs...');

    const existingFaculties = (
      await client.query<{ id: number; name: string; abbreviation: string | null }>(
        'SELECT id, name, abbreviation FROM faculties'
      )
    ).rows;

    const existingFacultyIds = new Set(existingFaculties.map((f) => f.id));
    const matchedFacultyCanonicalIds = new Set<number>();

    for (const ef of existingFaculties) {
      const efName = ef.name.trim().toLowerCase();
      const efAbbr = ef.abbreviation?.trim().toUpperCase();

      const matches = FACULTIES.filter(
        (f) =>
          f.name.trim().toLowerCase() === efName ||
          (efAbbr && f.abbreviation.trim().toUpperCase() === efAbbr)
      );

      if (matches.length > 1) {
        throw new Error(
          `[Catalogs]: Correspondencia ambigua detectada en facultades: la facultad existente ID ${ef.id} ('${ef.name}') coincide con ${matches.length} facultades canónicas.`
        );
      }

      if (matches.length === 1) {
        const matched = matches[0];
        if (matchedFacultyCanonicalIds.has(matched.id)) {
          throw new Error(
            `[Catalogs]: Correspondencia ambigua detectada: múltiples facultades existentes coinciden con la facultad canónica '${matched.name}'.`
          );
        }
        matchedFacultyCanonicalIds.add(matched.id);
        facultyIdMap.set(matched.id, ef.id);
        facultiesPreserved++;

        // Conservar su ID original intacto. Actualizar abreviatura si estaba ausente.
        if (!ef.abbreviation && matched.abbreviation) {
          await client.query('UPDATE faculties SET abbreviation = $1 WHERE id = $2', [
            matched.abbreviation,
            ef.id,
          ]);
        }
      } else {
        // Facultad no canónica preexistente: conservar intacta con su ID
        facultiesPreserved++;
        console.warn(
          `[Catalogs]: ℹ Facultad existente no canónica conservada con su ID original: ID ${ef.id} ('${ef.name}')`
        );
      }
    }

    // Insertar facultades canónicas faltantes sin pisar IDs ocupados
    await syncIdSequence(client, 'faculties');
    for (const f of FACULTIES) {
      if (!matchedFacultyCanonicalIds.has(f.id)) {
        let realId: number;
        if (!existingFacultyIds.has(f.id)) {
          // ID preferido está libre: insertar con f.id
          await client.query(
            'INSERT INTO faculties (id, name, abbreviation) VALUES ($1, $2, $3)',
            [f.id, f.name, f.abbreviation]
          );
          realId = f.id;
        } else {
          // ID preferido ocupado por otra entidad: la secuencia asigna el siguiente ID libre
          const insertRes = await client.query<{ id: number }>(
            'INSERT INTO faculties (name, abbreviation) VALUES ($1, $2) RETURNING id',
            [f.name, f.abbreviation]
          );
          realId = insertRes.rows[0].id;
        }
        existingFacultyIds.add(realId);
        facultyIdMap.set(f.id, realId);
        await syncIdSequence(client, 'faculties');
        facultiesInserted++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Carga y Sincronización de Escuelas Profesionales
    // ─────────────────────────────────────────────────────────────
    console.log('[Catalogs]: Sincronizando catálogo de Escuelas Profesionales conservando IDs...');

    const existingSchools = (
      await client.query<{ id: number; faculty_id: number; name: string; code: string | null }>(
        'SELECT id, faculty_id, name, code FROM professional_schools'
      )
    ).rows;

    const existingSchoolIds = new Set(existingSchools.map((s) => s.id));
    const matchedSchoolCanonicalIds = new Set<number>();

    for (const es of existingSchools) {
      const normalizedName = normalizeSchoolName(es.name).trim().toLowerCase();
      const esCode = es.code?.trim().toUpperCase();

      // Búsqueda por clave natural inequívoca
      const nameMatches = PROFESSIONAL_SCHOOLS.filter(
        (cs) => normalizeSchoolName(cs.name).trim().toLowerCase() === normalizedName
      );

      const codeMatches = esCode
        ? PROFESSIONAL_SCHOOLS.filter((cs) => SCHOOL_CODES[cs.id] === esCode)
        : [];

      // Diagnóstico de ambigüedad entre nombre y código
      if (nameMatches.length > 0 && codeMatches.length > 0) {
        if (nameMatches[0].id !== codeMatches[0].id) {
          throw new Error(
            `[Catalogs]: Correspondencia ambigua detectada en escuela existente ID ${es.id}: el nombre '${es.name}' coincide con la escuela canónica ID ${nameMatches[0].id} ('${nameMatches[0].name}'), pero el código '${es.code}' coincide con ID ${codeMatches[0].id} ('${codeMatches[0].name}'). Transacción abortada para evitar corrupción.`
          );
        }
      }

      const effectiveMatches = nameMatches.length > 0 ? nameMatches : codeMatches;

      if (effectiveMatches.length > 1) {
        throw new Error(
          `[Catalogs]: Correspondencia ambigua detectada: la escuela existente ID ${es.id} ('${es.name}') coincide con múltiples escuelas canónicas.`
        );
      }

      if (effectiveMatches.length === 1) {
        const canonical = effectiveMatches[0];
        if (matchedSchoolCanonicalIds.has(canonical.id)) {
          throw new Error(
            `[Catalogs]: Correspondencia ambigua detectada: múltiples escuelas existentes en base de datos coinciden con la escuela canónica '${canonical.name}'. Transacción abortada.`
          );
        }

        matchedSchoolCanonicalIds.add(canonical.id);
        schoolIdMap.set(canonical.id, es.id);
        schoolsPreserved++;

        // Conservar su ID original intacto. Actualizar código canónico si estaba nulo.
        const canonicalCode = SCHOOL_CODES[canonical.id];
        if (!es.code && canonicalCode) {
          await client.query('UPDATE professional_schools SET code = $1 WHERE id = $2', [
            canonicalCode,
            es.id,
          ]);
        }
      } else {
        // Escuela no canónica preexistente: conservar intacta con su ID
        schoolsPreserved++;
        console.warn(
          `[Catalogs]: ℹ Escuela existente no canónica conservada con su ID original: ID ${es.id} ('${es.name}')`
        );
      }
    }

    // Inserción de escuelas canónicas faltantes
    await syncIdSequence(client, 'professional_schools');
    for (const cs of PROFESSIONAL_SCHOOLS) {
      if (!matchedSchoolCanonicalIds.has(cs.id)) {
        const schoolCode = SCHOOL_CODES[cs.id] || null;

        // La facultad sale del mapa explícito canónico → real. Nunca se usa el ID canónico como
        // respaldo: podría pertenecer a otra facultad o no existir.
        const resolvedFacultyId = facultyIdMap.get(cs.faculty_id);
        if (resolvedFacultyId === undefined) {
          throw new Error(
            `[Catalogs]: No se pudo resolver la facultad real de la escuela canónica '${cs.name}' (facultad canónica ID ${cs.faculty_id}). Transacción abortada.`
          );
        }

        let realId: number;
        if (!existingSchoolIds.has(cs.id)) {
          // ID preferido está libre: insertar con cs.id
          await client.query(
            'INSERT INTO professional_schools (id, faculty_id, name, code) VALUES ($1, $2, $3, $4)',
            [cs.id, resolvedFacultyId, cs.name, schoolCode]
          );
          realId = cs.id;
        } else {
          // ID preferido ocupado por otra entidad existente: NO sobrescribir ni reasignar.
          // La secuencia, sincronizada bajo el bloqueo, asigna el siguiente ID libre.
          const insertRes = await client.query<{ id: number }>(
            'INSERT INTO professional_schools (faculty_id, name, code) VALUES ($1, $2, $3) RETURNING id',
            [resolvedFacultyId, cs.name, schoolCode]
          );
          realId = insertRes.rows[0].id;
        }
        existingSchoolIds.add(realId);
        schoolIdMap.set(cs.id, realId);
        await syncIdSequence(client, 'professional_schools');
        schoolsInserted++;
      }
    }

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
      `[Catalogs]: ✔ Catálogos sincronizados con éxito conservando todos los IDs existentes (Facultades: ${facultiesInserted} nuevas / ${facultiesPreserved} conservadas; Escuelas: ${schoolsInserted} nuevas / ${schoolsPreserved} conservadas; Pabellones: ${pavilionsLoaded}).`
    );

    return {
      facultiesInserted,
      facultiesPreserved,
      schoolsInserted,
      schoolsPreserved,
      pavilionsLoaded,
      facultyIdMap: Object.fromEntries(facultyIdMap),
      schoolIdMap: Object.fromEntries(schoolIdMap),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Catalogs]: ✘ Error al sincronizar catálogos (transacción revertida):', (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}
