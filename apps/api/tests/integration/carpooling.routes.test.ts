/**
 * Integration Test Suite: Carpooling HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest.
 * - Infrastructure (pg pool, ioredis, JWT) mocked at module level.
 * - Tests assert HTTP status codes and JSON response shape.
 *
 * Routes under test:
 *   GET   /api/v1/carpooling
 *   POST  /api/v1/carpooling/:route_id/request
 *   PATCH /api/v1/carpooling/:route_id/confirm
 */

// ─── Module Mocks ─────────────────────────────────────────────────────────────

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../src/config/jwt', () => ({
  signAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import request from 'supertest';
import { pool } from '../../src/config/database';
import { verifyAccessToken } from '../../src/config/jwt';
import { createTestApp } from '../helpers/test-app';

const app = createTestApp();
import { TokenPayload } from '../../src/config/jwt';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockVerify = verifyAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const driverId = 'driver-uuid-cp-0001';
const passengerId = 'passenger-uuid-cp-0001';
const routeId = 'route-uuid-cp-0001';

const driverPayload: TokenPayload = {
  jti: 'jti-driver', user_id: driverId, role: 'student',
  school_id: 3, has_accepted_terms: true, facultad_id: 1, escuela_id: 3, ciclo: 6,
};

const passengerPayload: TokenPayload = {
  jti: 'jti-passenger', user_id: passengerId, role: 'student',
  school_id: 3, has_accepted_terms: true, facultad_id: 1, escuela_id: 3, ciclo: 6,
};

const mockRoute = {
  id: routeId,
  driver_id: driverId,
  origin_district: 'Ayacucho',
  destination: 'UNSCH',
  destination_pavilion_code: 'A',
  departure_time: new Date('2026-07-10T07:00:00Z').toISOString(),
  available_seats: 3,
  price_soles: 2.0,
  driver_alias: 'El Rápido',
  created_at: new Date().toISOString(),
};

const mockRouteDetail = {
  route_id: routeId,
  origin_district: 'Ayacucho',
  destination: 'UNSCH',
  departure_time: new Date('2026-07-10T07:00:00Z').toISOString(),
  available_seats: 3,
  price_soles: 2.0,
  driver_alias: 'El Rápido',
};

const mockSeatRequest = {
  id: 'req-uuid-cp-0001',
  route_id: routeId,
  passenger_id: passengerId,
  status: 'SEAT_REQUESTED',
  created_at: new Date().toISOString(),
};

const mockContact = {
  full_name: 'Juan Pérez',
  email: 'j.perez@unsch.edu.pe',
  phone_number: '+51987654321',
  whatsapp_link: 'https://wa.me/51987654321',
};

const buildMockClient = () => ({ query: jest.fn(), release: jest.fn() });

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Carpooling HTTP Routes — Integration', () => {

  // ════════════════════════════════════════════════════════════════════
  // GET /api/v1/carpooling
  // ════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/carpooling', () => {

    it('should return 200 with data array when authenticated', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockRouteDetail, { ...mockRouteDetail, route_id: 'route-2' }] });

      const response = await request(app)
        .get('/api/v1/carpooling')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return 200 with empty data when no routes are active', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/carpooling')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 200 when origin_district filter is provided', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockRouteDetail] });

      const response = await request(app)
        .get('/api/v1/carpooling?origin_district=Ayacucho')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });

    it('should sanitize origin_district filter with special XSS characters', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockRouteDetail] });

      const response = await request(app)
        .get('/api/v1/carpooling?origin_district=San&<>"\'Juan')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app).get('/api/v1/carpooling');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN with malformed token', async () => {
      const response = await request(app)
        .get('/api/v1/carpooling')
        .set('Authorization', 'Token invalid');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 500 on unexpected database error', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockRejectedValueOnce(new Error('DB failure'));

      const response = await request(app)
        .get('/api/v1/carpooling')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(500);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // POST /api/v1/carpooling/:route_id/request
  // ════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/carpooling/:route_id/request', () => {

    it('should return 201 on successful seat request', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      const passengerMeta = { full_name: 'Luis Torres', academic_cycle: 5, school_name: 'Ing. Sistemas' };
      mockQuery
        .mockResolvedValueOnce({ rows: [mockRoute], rowCount: 1 }) // findRouteById
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing request
        .mockResolvedValueOnce({ rows: [passengerMeta], rowCount: 1 }) // getPassengerMeta
        .mockResolvedValueOnce({ rows: [mockSeatRequest], rowCount: 1 }); // createRequest

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.request_id).toBeDefined();
    });

    it('should return 404 ERR_CARPOOLING_ROUTE_NOT_FOUND when route does not exist', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_CARPOOLING_ROUTE_NOT_FOUND');
    });

    it('should return 400 ERR_CARPOOLING_SELF_BOOKING when passenger is the driver', async () => {
      mockVerify.mockReturnValueOnce(driverPayload); // driver trying to book own route
      mockQuery.mockResolvedValueOnce({ rows: [mockRoute], rowCount: 1 }); // route with driver_id = driverId

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer driver.token');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_CARPOOLING_SELF_BOOKING');
    });

    it('should return 400 ERR_CARPOOLING_NO_SEATS when no seats are available', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockResolvedValueOnce({ rows: [{ ...mockRoute, available_seats: 0 }], rowCount: 1 });

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_CARPOOLING_NO_SEATS');
    });

    it('should return 400 ERR_CARPOOLING_DUPLICATE_REQUEST when request already exists', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery
        .mockResolvedValueOnce({ rows: [mockRoute], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...mockSeatRequest, status: 'SEAT_REQUESTED' }], rowCount: 1 });

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_CARPOOLING_DUPLICATE_REQUEST');
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_UNAUTHORIZED when passenger token lacks user_id', async () => {
      mockVerify.mockReturnValueOnce({ ...passengerPayload, user_id: undefined as any });

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_UNAUTHORIZED');
    });

    it('should return 500 on unexpected database error', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload);
      mockQuery.mockRejectedValueOnce(new Error('DB crash'));

      const response = await request(app)
        .post(`/api/v1/carpooling/${routeId}/request`)
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(500);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // PATCH /api/v1/carpooling/:route_id/confirm
  // ════════════════════════════════════════════════════════════════════

  describe('PATCH /api/v1/carpooling/:route_id/confirm', () => {
    const validConfirmBody = { passenger_id: passengerId };

    it('should return 200 on successful seat confirmation', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockRoute] }) // lock route
        .mockResolvedValueOnce({ rows: [mockSeatRequest] }) // lock request
        .mockResolvedValueOnce(undefined) // UPDATE request
        .mockResolvedValueOnce(undefined) // UPDATE seats
        .mockResolvedValueOnce({ rows: [mockContact] }) // driver contact
        .mockResolvedValueOnce({ rows: [{ ...mockContact, full_name: 'Ana' }] }) // passenger contact
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('SEAT_CONFIRMED');
    });

    it('should return 401 ERR_AUTH_UNAUTHORIZED when driver token lacks user_id', async () => {
      mockVerify.mockReturnValueOnce({ ...driverPayload, user_id: undefined as any });

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_UNAUTHORIZED');
    });

    it('should return 400 when passenger_id is missing from body', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send({})
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_MISSING_FIELDS');
    });

    it('should return 404 ERR_CARPOOLING_ROUTE_NOT_FOUND when route does not exist', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // route not found
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_CARPOOLING_ROUTE_NOT_FOUND');
    });

    it('should return 403 ERR_CARPOOLING_FORBIDDEN when user is not the driver', async () => {
      mockVerify.mockReturnValueOnce(passengerPayload); // passenger trying to confirm
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [mockRoute] }) // route has different driver_id
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer passenger.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ERR_CARPOOLING_FORBIDDEN');
    });

    it('should return 400 ERR_CARPOOLING_NO_SEATS when seats ran out during confirmation', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ ...mockRoute, available_seats: 0 }] })
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_CARPOOLING_NO_SEATS');
    });

    it('should return 404 ERR_CARPOOLING_REQUEST_NOT_FOUND when request does not exist', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [mockRoute] })
        .mockResolvedValueOnce({ rows: [] }) // request not found
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_CARPOOLING_REQUEST_NOT_FOUND');
    });

    it('should return 400 ERR_CARPOOLING_INVALID_STATE when request status is not SEAT_REQUESTED', async () => {
      mockVerify.mockReturnValueOnce(driverPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [mockRoute] })
        .mockResolvedValueOnce({ rows: [{ ...mockSeatRequest, status: 'SEAT_CONFIRMED' }] })
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Authorization', 'Bearer driver.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_CARPOOLING_INVALID_STATE');
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app)
        .patch(`/api/v1/carpooling/${routeId}/confirm`)
        .send(validConfirmBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });
  });
});
