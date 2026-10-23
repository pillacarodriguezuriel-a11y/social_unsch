/**
 * Integration Test Suite: Catalogs HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest.
 * - Tests public catalog retrieval without authentication.
 * - Asserts that persisted IDs from database are returned directly without fixed ID mapping.
 */

jest.mock('../../src/config/redis', () => ({
  redis: { on: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

import request from 'supertest';
import { pool } from '../../src/config/database';
import app from '../../src/app';

const mockQuery = pool.query as jest.Mock;

describe('Catalogs HTTP Routes — Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/catalogs', () => {
    it('should return 200 and catalog payload with real persisted IDs', async () => {
      const mockFaculties = [
        { id: 10, name: 'Facultad de Ingeniería', abbreviation: 'FI' },
      ];
      const mockSchools = [
        { id: 99, faculty_id: 10, name: 'Ingeniería de Sistemas', code: 'ISI' },
        { id: 105, faculty_id: 10, name: 'Ingeniería Civil', code: 'ICI' },
      ];
      const mockPavilions = [
        { code: 'Hs', name: 'Pabellón Hs' },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockFaculties, rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockSchools, rowCount: 2 })
        .mockResolvedValueOnce({ rows: mockPavilions, rowCount: 1 });

      const response = await request(app).get('/api/v1/catalogs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.faculties).toEqual(mockFaculties);
      expect(response.body.data.schools).toEqual(mockSchools);
      expect(response.body.data.pavilions).toEqual(mockPavilions);
      // Confirma que el ID 99 persistido se conserva y no se reasigna a 20
      expect(response.body.data.schools[0].id).toBe(99);
    });

    it('should return 500 when database throws unexpectedly', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB failure'));

      const response = await request(app).get('/api/v1/catalogs');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/catalogs/schools', () => {
    it('should return 200 and schools list with persisted IDs', async () => {
      const mockSchools = [
        { id: 42, faculty_id: 1, name: 'Agronomía', code: 'AGR' },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockSchools, rowCount: 1 });

      const response = await request(app).get('/api/v1/catalogs/schools');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSchools);
      expect(response.body.data[0].id).toBe(42);
    });

    it('should return 500 when database throws on schools query', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error on schools'));

      const response = await request(app).get('/api/v1/catalogs/schools');

      expect(response.status).toBe(500);
    });
  });
});
