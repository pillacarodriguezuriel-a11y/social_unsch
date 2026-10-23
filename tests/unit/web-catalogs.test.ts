/**
 * Unit Test Suite: catálogo del frontend (app/lib/catalogs.ts)
 *
 * Regresión: el frontend enviaba IDs de constantes locales cuando la carga del catálogo fallaba,
 * y además leía la respuesta con una forma incorrecta, por lo que nunca aplicaba el catálogo real.
 */

jest.mock('../../app/lib/api', () => ({
  api: { get: jest.fn() },
}));

import { api } from '../../app/lib/api';
import {
  CatalogUnavailableError,
  findSchool,
  groupSchoolsByFaculty,
  loadCatalogs,
  parseCatalogResponse,
  resolveSchoolSelection,
} from '../../app/lib/catalogs';

const mockGet = api.get as jest.Mock;

// Respuesta real de GET /api/v1/catalogs: IDs distintos de las constantes canónicas (1..31).
const apiBody = {
  success: true,
  data: {
    faculties: [
      { id: 7, name: 'Ingeniería de Minas, Geología y Civil', abbreviation: 'FIMGC' },
      { id: 40, name: 'Derecho', abbreviation: null },
    ],
    schools: [
      { id: 99, faculty_id: 7, name: 'Ingeniería de Sistemas', code: 'ISI' },
      { id: 120, faculty_id: 40, name: 'Derecho', code: 'DER' },
    ],
    pavilions: [],
  },
};

describe('parseCatalogResponse', () => {
  it('lee facultades y escuelas desde data, como las devuelve la API', () => {
    const catalog = parseCatalogResponse(apiBody);
    expect(catalog.schools.map((s) => s.id)).toEqual([99, 120]);
    expect(catalog.faculties.map((f) => f.id)).toEqual([7, 40]);
  });

  it('rechaza cuerpos sin la envoltura data', () => {
    expect(() => parseCatalogResponse(apiBody.data)).toThrow(CatalogUnavailableError);
    expect(() => parseCatalogResponse(null)).toThrow(CatalogUnavailableError);
  });

  it('rechaza un catálogo sin escuelas en lugar de devolver una lista vacía utilizable', () => {
    expect(() => parseCatalogResponse({ data: { faculties: [], schools: [] } })).toThrow(
      'El catálogo de escuelas profesionales está vacío.'
    );
  });

  it('descarta filas con IDs no válidos', () => {
    const catalog = parseCatalogResponse({
      data: {
        faculties: [{ id: 1, name: 'F', abbreviation: null }, { id: 'x', name: 'Mal' }],
        schools: [{ id: 5, faculty_id: 1, name: 'E', code: null }, { id: 0, faculty_id: 1, name: 'Cero' }],
      },
    });
    expect(catalog.faculties).toHaveLength(1);
    expect(catalog.schools).toHaveLength(1);
  });
});

describe('selección de escuela', () => {
  const catalog = parseCatalogResponse(apiBody);

  it('agrupa con los IDs reales y omite facultades vacías', () => {
    const groups = groupSchoolsByFaculty({
      ...catalog,
      faculties: [...catalog.faculties, { id: 3, name: 'Sin escuelas', abbreviation: null }],
    });
    expect(groups.map((g) => g.faculty.id)).toEqual([7, 40]);
    expect(groups[0].schools[0].id).toBe(99);
  });

  it('acepta solo IDs presentes en el catálogo persistido', () => {
    expect(resolveSchoolSelection(catalog, '99')).toBe(99);
    expect(resolveSchoolSelection(catalog, '')).toBeNull();
    // 20 es el ID canónico de Ingeniería de Sistemas en las constantes, pero no existe en esta base.
    expect(resolveSchoolSelection(catalog, '20')).toBeUndefined();
  });

  it('no permite enviar ninguna escuela si el catálogo no está cargado', () => {
    expect(resolveSchoolSelection(null, '20')).toBeUndefined();
    expect(resolveSchoolSelection(undefined, '99')).toBeUndefined();
    expect(resolveSchoolSelection(null, '')).toBeNull();
  });

  it('resuelve la facultad real de una escuela', () => {
    expect(findSchool(catalog, 120)?.faculty_id).toBe(40);
    expect(findSchool(catalog, null)).toBeUndefined();
  });
});

describe('loadCatalogs', () => {
  beforeEach(() => mockGet.mockReset());

  it('propaga el fallo de red y permite reintentar sin conservar una promesa rechazada', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));
    await expect(loadCatalogs({ force: true })).rejects.toThrow('Network Error');

    mockGet.mockResolvedValueOnce({ data: apiBody });
    const catalog = await loadCatalogs();
    expect(catalog.schools[0].id).toBe(99);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('reutiliza la misma descarga mientras no se fuerce', async () => {
    mockGet.mockResolvedValue({ data: apiBody });
    await loadCatalogs({ force: true });
    await loadCatalogs();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
