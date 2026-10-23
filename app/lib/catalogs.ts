import { api } from './api';

/**
 * Catálogo académico persistido (facultades y escuelas con sus IDs reales).
 *
 * Regla: cualquier selección que se envíe a la API debe salir de este catálogo. Las constantes de
 * unsch.constants.ts describen la taxonomía canónica, pero sus IDs pueden no coincidir con los de la
 * base de datos; no deben usarse para operaciones persistentes.
 */

export interface CatalogFaculty {
  id: number;
  name: string;
  abbreviation: string | null;
}

export interface CatalogSchool {
  id: number;
  faculty_id: number;
  name: string;
  code: string | null;
}

export interface CatalogData {
  faculties: CatalogFaculty[];
  schools: CatalogSchool[];
}

export interface SchoolGroup {
  faculty: CatalogFaculty;
  schools: CatalogSchool[];
}

export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogUnavailableError';
  }
}

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/**
 * Valida el cuerpo de GET /api/v1/catalogs ({ success, data: { faculties, schools } }).
 * Lanza CatalogUnavailableError si la forma no es la esperada o si no hay escuelas.
 */
export function parseCatalogResponse(body: unknown): CatalogData {
  const data = (body as { data?: unknown } | null)?.data as
    | { faculties?: unknown; schools?: unknown }
    | undefined;
  if (!data || !Array.isArray(data.faculties) || !Array.isArray(data.schools)) {
    throw new CatalogUnavailableError('La respuesta del catálogo no tiene la forma esperada.');
  }

  const faculties = data.faculties.filter(
    (f): f is CatalogFaculty => isPositiveInt((f as CatalogFaculty)?.id) && typeof (f as CatalogFaculty)?.name === 'string'
  );
  const schools = data.schools.filter(
    (s): s is CatalogSchool =>
      isPositiveInt((s as CatalogSchool)?.id) &&
      isPositiveInt((s as CatalogSchool)?.faculty_id) &&
      typeof (s as CatalogSchool)?.name === 'string'
  );

  if (schools.length === 0) {
    throw new CatalogUnavailableError('El catálogo de escuelas profesionales está vacío.');
  }
  return { faculties, schools };
}

/** Agrupa escuelas por facultad usando solo IDs reales; omite facultades sin escuelas. */
export function groupSchoolsByFaculty(catalog: CatalogData): SchoolGroup[] {
  return catalog.faculties
    .map((faculty) => ({
      faculty,
      schools: catalog.schools.filter((s) => s.faculty_id === faculty.id),
    }))
    .filter((group) => group.schools.length > 0);
}

export function findSchool(catalog: CatalogData | null | undefined, schoolId: number | null | undefined) {
  if (!catalog || !isPositiveInt(schoolId)) return undefined;
  return catalog.schools.find((s) => s.id === schoolId);
}

/**
 * Convierte el valor de un <select> en un ID de escuela enviable.
 * - '' → null (sin selección).
 * - ID presente en el catálogo real → ese ID.
 * - Cualquier otro caso (catálogo no cargado o ID ajeno al catálogo) → undefined: no debe enviarse.
 */
export function resolveSchoolSelection(
  catalog: CatalogData | null | undefined,
  value: string
): number | null | undefined {
  if (value === '') return null;
  const id = Number(value);
  return findSchool(catalog, id) ? id : undefined;
}

let pending: Promise<CatalogData> | null = null;

/** Descarga el catálogo una vez por sesión de página; force=true reintenta tras un fallo. */
export function loadCatalogs(options: { force?: boolean } = {}): Promise<CatalogData> {
  if (!pending || options.force) {
    pending = api
      .get('/catalogs')
      .then((res) => parseCatalogResponse(res.data))
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
