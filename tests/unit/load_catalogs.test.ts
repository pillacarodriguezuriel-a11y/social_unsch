/**
 * Unit Test Suite: loadCatalogs (regresión de la etapa 3)
 *
 * Usa un cliente PostgreSQL simulado que responde según la sentencia recibida, para comprobar:
 *   - que una facultad reconocida por abreviatura se usa como facultad real de sus escuelas nuevas;
 *   - que las tablas se bloquean al inicio de la transacción;
 *   - que los IDs alternativos salen de la secuencia y no de un MAX(id) + 1 calculado aparte;
 *   - que una ambigüedad revierte la transacción.
 */

jest.mock('../../src/config/database', () => ({
  pool: { connect: jest.fn() },
}));

import { Pool } from 'pg';
import { loadCatalogs } from '../../src/database/migrations/load_catalogs';

interface FakeState {
  faculties: Array<{ id: number; name: string; abbreviation: string | null }>;
  schools: Array<{ id: number; faculty_id: number; name: string; code: string | null }>;
}

function buildFakePool(state: FakeState) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let nextFacultyId = 100;
  let nextSchoolId = 200;

  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id, name, abbreviation FROM faculties')) {
        return { rows: state.faculties };
      }
      if (sql.startsWith('SELECT id, faculty_id, name, code FROM professional_schools')) {
        return { rows: state.schools };
      }
      if (sql.startsWith('INSERT INTO faculties (name')) {
        return { rows: [{ id: nextFacultyId++ }] };
      }
      if (sql.startsWith('INSERT INTO professional_schools (faculty_id')) {
        return { rows: [{ id: nextSchoolId++ }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };

  const pool = { connect: jest.fn(async () => client) } as unknown as Pool;
  return { pool, client, calls };
}

const schoolInserts = (calls: Array<{ sql: string; params?: unknown[] }>) =>
  calls.filter((c) => c.sql.startsWith('INSERT INTO professional_schools'));

describe('loadCatalogs', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('asocia las escuelas nuevas a la facultad real reconocida por abreviatura, no al ID canónico', async () => {
    // La facultad canónica 4 ('Derecho y Ciencias Políticas', FDCP) existe con otro nombre e ID 40.
    // El ID 4 está ocupado por una facultad histórica distinta.
    const { pool, calls } = buildFakePool({
      faculties: [
        { id: 40, name: 'Derecho', abbreviation: 'FDCP' },
        { id: 4, name: 'Facultad Histórica', abbreviation: 'FH' },
      ],
      schools: [],
    });

    const result = await loadCatalogs(pool);

    expect(result.facultyIdMap[4]).toBe(40);
    // La escuela canónica 10 (Derecho) pertenece a la facultad canónica 4.
    const derecho = schoolInserts(calls).find((c) => (c.params as unknown[]).includes('Derecho'));
    expect(derecho).toBeDefined();
    expect(derecho!.params![1]).toBe(40);
    // No se crea una segunda facultad 'Derecho y Ciencias Políticas'.
    const facultyInserts = calls.filter((c) => c.sql.startsWith('INSERT INTO faculties'));
    expect(facultyInserts.some((c) => (c.params as unknown[]).includes('Derecho y Ciencias Políticas'))).toBe(false);
  });

  it('bloquea las tablas de catálogo inmediatamente después de BEGIN', async () => {
    const { pool, calls } = buildFakePool({ faculties: [], schools: [] });

    await loadCatalogs(pool);

    expect(calls[0].sql).toBe('BEGIN');
    expect(calls[1].sql).toBe('LOCK TABLE faculties, professional_schools IN SHARE ROW EXCLUSIVE MODE');
  });

  it('usa la secuencia para un ID preferido ocupado y no calcula MAX(id) + 1 por separado', async () => {
    const { pool, calls } = buildFakePool({
      faculties: [{ id: 7, name: 'Ingeniería de Minas, Geología y Civil', abbreviation: 'FIMGC' }],
      // El ID 20 (preferido de Ingeniería de Sistemas) está ocupado por otra escuela.
      schools: [{ id: 20, faculty_id: 7, name: 'Escuela Especial Previa', code: 'EEP' }],
    });

    const result = await loadCatalogs(pool);

    expect(calls.some((c) => c.sql.includes('AS next_id'))).toBe(false);
    const sistemas = schoolInserts(calls).find((c) => (c.params as unknown[]).includes('Ingeniería de Sistemas'));
    expect(sistemas!.sql).toBe(
      'INSERT INTO professional_schools (faculty_id, name, code) VALUES ($1, $2, $3) RETURNING id'
    );
    expect(result.schoolIdMap[20]).toBeGreaterThanOrEqual(200);
    expect(calls.some((c) => c.sql.includes("pg_get_serial_sequence('professional_schools', 'id')"))).toBe(true);
  });

  it('conserva los IDs existentes en el mapa canónico → real', async () => {
    const { pool } = buildFakePool({
      faculties: [{ id: 7, name: 'Ingeniería de Minas, Geología y Civil', abbreviation: 'FIMGC' }],
      schools: [{ id: 99, faculty_id: 7, name: 'Ingeniería de Sistemas', code: null }],
    });

    const result = await loadCatalogs(pool);

    expect(result.facultyIdMap[7]).toBe(7);
    expect(result.schoolIdMap[20]).toBe(99);
  });

  it('revierte la transacción ante una correspondencia ambigua', async () => {
    const { pool, client, calls } = buildFakePool({
      faculties: [{ id: 1, name: 'Facultad Base', abbreviation: 'FB' }],
      schools: [{ id: 50, faculty_id: 1, name: 'Ingeniería de Sistemas', code: 'DER' }],
    });

    await expect(loadCatalogs(pool)).rejects.toThrow('Correspondencia ambigua detectada');

    expect(calls.map((c) => c.sql)).toContain('ROLLBACK');
    expect(calls.map((c) => c.sql)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});
