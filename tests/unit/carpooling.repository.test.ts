/**
 * Unit Test Suite: CarpoolingRepository
 *
 * Mocks: pg pool (query + connect)
 * Covers:
 *   - findActiveRoutes(): sin filtro, con filtro, ORDER BY presente
 *   - findRouteById(): encontrado, no encontrado
 *   - findRequest(): encontrado, no encontrado
 *   - createRequest(): happy path, query shape
 *   - getPassengerMeta(): con resultado, sin resultado (null)
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../../src/config/database';
import {
  CarpoolingRepository,
  RouteDetail,
  CarpoolingRoute,
  CarpoolingRequest,
} from '../../src/modules/carpooling/carpooling.repository';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;

const makeRouteDetail = (overrides: Partial<RouteDetail> = {}): RouteDetail => ({
  route_id: 'route-uuid-0001',
  origin_district: 'Ayacucho',
  destination: 'UNSCH',
  departure_time: new Date('2026-07-10T07:00:00Z'),
  available_seats: 3,
  price_soles: 2.0,
  driver_alias: 'El Rápido',
  ...overrides,
});

const makeRoute = (overrides: Partial<CarpoolingRoute> = {}): CarpoolingRoute => ({
  id: 'route-uuid-0001',
  driver_id: 'driver-uuid-0001',
  origin_district: 'Ayacucho',
  destination: 'UNSCH',
  destination_pavilion_code: 'A',
  departure_time: new Date('2026-07-10T07:00:00Z'),
  available_seats: 3,
  price_soles: 2.0,
  driver_alias: 'El Rápido',
  created_at: new Date(),
  ...overrides,
});

const makeRequest = (overrides: Partial<CarpoolingRequest> = {}): CarpoolingRequest => ({
  id: 'req-uuid-0001',
  route_id: 'route-uuid-0001',
  passenger_id: 'pass-uuid-0001',
  status: 'SEAT_REQUESTED',
  created_at: new Date(),
  ...overrides,
});

describe('CarpoolingRepository', () => {
  let repo: CarpoolingRepository;

  beforeEach(() => {
    repo = new CarpoolingRepository();
  });

  // ════════════════════════════════════════════════════════════════════
  // findActiveRoutes()
  // ════════════════════════════════════════════════════════════════════

  describe('findActiveRoutes()', () => {
    it('should return all active routes when no filter is provided', async () => {
      const routes = [makeRouteDetail(), makeRouteDetail({ route_id: 'route-uuid-0002' })];
      mockQuery.mockResolvedValueOnce({ rows: routes });
      const result = await repo.findActiveRoutes();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active routes exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await repo.findActiveRoutes();
      expect(result).toEqual([]);
    });

    it('should NOT include district filter in query when originDistrict is undefined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findActiveRoutes();
      const [queryText, values] = mockQuery.mock.calls[0];
      expect(queryText).not.toContain('origin_district = $1');
      expect(values).toEqual([]);
    });

    it('should include district filter when originDistrict is provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findActiveRoutes('Ayacucho');
      const [queryText, values] = mockQuery.mock.calls[0];
      expect(queryText).toContain('origin_district = $1');
      expect(values).toContain('Ayacucho');
    });

    it('should ORDER BY departure_time ASC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findActiveRoutes();
      const [queryText] = mockQuery.mock.calls[0];
      expect(queryText).toContain('ORDER BY departure_time ASC');
    });

    it('should filter routes with available_seats > 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findActiveRoutes();
      const [queryText] = mockQuery.mock.calls[0];
      expect(queryText).toContain('available_seats > 0');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // findRouteById()
  // ════════════════════════════════════════════════════════════════════

  describe('findRouteById()', () => {
    it('should return a CarpoolingRoute when it exists', async () => {
      const route = makeRoute();
      mockQuery.mockResolvedValueOnce({ rows: [route], rowCount: 1 });
      const result = await repo.findRouteById('route-uuid-0001');
      expect(result).toEqual(route);
    });

    it('should return null when no route matches the id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await repo.findRouteById('non-existent');
      expect(result).toBeNull();
    });

    it('should pass routeId in the query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findRouteById('my-route-id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe('my-route-id');
    });

    it('should use a named prepared statement', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findRouteById('id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.name).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // findRequest()
  // ════════════════════════════════════════════════════════════════════

  describe('findRequest()', () => {
    it('should return a CarpoolingRequest when it exists', async () => {
      const request = makeRequest();
      mockQuery.mockResolvedValueOnce({ rows: [request], rowCount: 1 });
      const result = await repo.findRequest('route-uuid-0001', 'pass-uuid-0001');
      expect(result).toEqual(request);
    });

    it('should return null when no request matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await repo.findRequest('route-uuid-0001', 'ghost-passenger');
      expect(result).toBeNull();
    });

    it('should pass routeId and passengerId in the query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findRequest('r-id', 'p-id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe('r-id');
      expect(callArg.values[1]).toBe('p-id');
    });

    it('should SELECT from carpooling_requests table', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findRequest('r', 'p');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('carpooling_requests');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // createRequest()
  // ════════════════════════════════════════════════════════════════════

  describe('createRequest()', () => {
    it('should return the newly created CarpoolingRequest', async () => {
      const newRequest = makeRequest();
      mockQuery.mockResolvedValueOnce({ rows: [newRequest], rowCount: 1 });
      const result = await repo.createRequest('route-uuid-0001', 'pass-uuid-0001');
      expect(result).toEqual(newRequest);
    });

    it('should INSERT with status SEAT_REQUESTED', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRequest()] });
      await repo.createRequest('route-uuid-0001', 'pass-uuid-0001');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain("'SEAT_REQUESTED'");
    });

    it('should pass routeId and passengerId in the query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRequest()] });
      await repo.createRequest('my-route', 'my-passenger');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe('my-route');
      expect(callArg.values[1]).toBe('my-passenger');
    });

    it('should use RETURNING clause to get the full row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRequest()] });
      await repo.createRequest('r', 'p');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('RETURNING');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // getPassengerMeta()
  // ════════════════════════════════════════════════════════════════════

  describe('getPassengerMeta()', () => {
    it('should return passenger meta when passenger exists', async () => {
      const meta = { full_name: 'Luis Flores', academic_cycle: 5, school_name: 'Ing. Sistemas' };
      mockQuery.mockResolvedValueOnce({ rows: [meta], rowCount: 1 });
      const result = await repo.getPassengerMeta('pass-uuid-0001');
      expect(result).toEqual(meta);
    });

    it('should return null when passenger is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await repo.getPassengerMeta('ghost-passenger');
      expect(result).toBeNull();
    });

    it('should pass passengerId in query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getPassengerMeta('target-passenger-id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe('target-passenger-id');
    });

    it('should JOIN professional_schools to get school_name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getPassengerMeta('pid');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('professional_schools');
    });
  });
});
