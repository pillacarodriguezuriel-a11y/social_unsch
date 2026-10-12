/**
 * Unit Test Suite: CarpoolingService
 *
 * Mocks: pg pool (query + connect for transactions)
 * Covers:
 *   - getActiveRoutes(): with/without district filter
 *   - requestSeat(): route not found, self-booking, no seats, duplicate request,
 *     happy path with passenger meta
 *   - confirmSeat(): ROUTE_NOT_FOUND, NOT_ROUTE_DRIVER, NO_SEATS_AVAILABLE,
 *     REQUEST_NOT_FOUND, INVALID_REQUEST_STATUS, happy path with contact info
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../../src/config/database';
import { CarpoolingService } from '../../src/modules/carpooling/carpooling.service';
import { CarpoolingRoute, CarpoolingRequest, RouteDetail, ContactInfo } from '../../src/modules/carpooling/carpooling.repository';
import { AppError } from '../../src/shared/errors/AppError';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
  passenger_id: 'passenger-uuid-0001',
  status: 'SEAT_REQUESTED',
  created_at: new Date(),
  ...overrides,
});

const makeRouteDetail = (overrides: Partial<RouteDetail> = {}): RouteDetail => ({
  route_id: 'route-uuid-0001',
  origin_district: 'Ayacucho',
  destination: 'UNSCH',
  departure_time: new Date(),
  available_seats: 3,
  price_soles: 2.0,
  driver_alias: 'El Rápido',
  ...overrides,
});

const makeContact = (overrides: Partial<ContactInfo> = {}): ContactInfo => ({
  full_name: 'Juan Pérez',
  email: 'j.perez@unsch.edu.pe',
  phone_number: '+51987654321',
  whatsapp_link: 'https://wa.me/51987654321',
  ...overrides,
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CarpoolingService', () => {
  let service: CarpoolingService;

  beforeEach(() => {
    service = new CarpoolingService();
  });

  // ════════════════════════════════════════════════════════════════════
  // getActiveRoutes()
  // ════════════════════════════════════════════════════════════════════

  describe('getActiveRoutes()', () => {
    it('should return all active routes when no district filter is provided', async () => {
      const routes = [makeRouteDetail(), makeRouteDetail({ route_id: 'route-uuid-0002' })];
      mockQuery.mockResolvedValueOnce({ rows: routes });
      const result = await service.getActiveRoutes();
      expect(result).toHaveLength(2);
    });

    it('should return filtered routes when originDistrict is provided', async () => {
      const routes = [makeRouteDetail()];
      mockQuery.mockResolvedValueOnce({ rows: routes });
      const result = await service.getActiveRoutes('Ayacucho');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no routes match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getActiveRoutes('Huamanga');
      expect(result).toEqual([]);
    });

    it('should pass the district filter to the repository query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getActiveRoutes('Carmen Alto');
      const queryValues = mockQuery.mock.calls[0][1];
      expect(queryValues).toContain('Carmen Alto');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // requestSeat()
  // ════════════════════════════════════════════════════════════════════

  describe('requestSeat()', () => {
    const routeId = 'route-uuid-0001';
    const passengerId = 'passenger-uuid-0001';
    const driverId = 'driver-uuid-0001';

    it('should throw AppError 404 ERR_CARPOOLING_ROUTE_NOT_FOUND when route does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // findRouteById
      await expect(service.requestSeat(routeId, passengerId)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_CARPOOLING_ROUTE_NOT_FOUND',
        message: 'Ruta no encontrada.',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_SELF_BOOKING when passenger is the driver', async () => {
      const route = makeRoute({ driver_id: passengerId }); // same id
      mockQuery.mockResolvedValueOnce({ rows: [route], rowCount: 1 });
      await expect(service.requestSeat(routeId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_SELF_BOOKING',
        message: 'No puedes solicitar un asiento en tu propia ruta.',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_NO_SEATS when available_seats = 0', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [route], rowCount: 1 }); // findRouteById
      await expect(service.requestSeat(routeId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_NO_SEATS',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_DUPLICATE_REQUEST when request is SEAT_REQUESTED', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      const existingRequest = makeRequest({ status: 'SEAT_REQUESTED' });
      mockQuery
        .mockResolvedValueOnce({ rows: [route], rowCount: 1 }) // findRouteById
        .mockResolvedValueOnce({ rows: [existingRequest], rowCount: 1 }); // findRequest
      await expect(service.requestSeat(routeId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_DUPLICATE_REQUEST',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_DUPLICATE_REQUEST when request is SEAT_CONFIRMED', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      const existingRequest = makeRequest({ status: 'SEAT_CONFIRMED' });
      mockQuery
        .mockResolvedValueOnce({ rows: [route], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [existingRequest], rowCount: 1 });
      await expect(service.requestSeat(routeId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_DUPLICATE_REQUEST',
      });
    });

    it('should allow request if existing status is SEAT_REJECTED', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      const rejectedRequest = makeRequest({ status: 'SEAT_REJECTED' });
      const newRequest = makeRequest();
      const passengerMeta = { full_name: 'Luis Flores', academic_cycle: 5, school_name: 'Ingeniería' };
      mockQuery
        .mockResolvedValueOnce({ rows: [route], rowCount: 1 }) // findRouteById
        .mockResolvedValueOnce({ rows: [rejectedRequest], rowCount: 1 }) // findRequest (rejected, allowed)
        .mockResolvedValueOnce({ rows: [newRequest], rowCount: 1 }) // createRequest
        .mockResolvedValueOnce({ rows: [passengerMeta], rowCount: 1 }); // getPassengerMeta
      const result = await service.requestSeat(routeId, passengerId);
      expect(result.request_id).toBe(newRequest.id);
    });

    it('should return correct request details on successful seat request', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      const newRequest = makeRequest();
      const passengerMeta = { full_name: 'Luis Alberto Flores', academic_cycle: 5, school_name: 'Ing. Sistemas' };
      mockQuery
        .mockResolvedValueOnce({ rows: [route], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing request
        .mockResolvedValueOnce({ rows: [newRequest], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [passengerMeta], rowCount: 1 });

      const result = await service.requestSeat(routeId, passengerId);
      expect(result.request_id).toBe(newRequest.id);
      expect(result.route_id).toBe(routeId);
      expect(result.status).toBe('SEAT_REQUESTED');
      expect(result.driver_alias).toBe('El Rápido');
      expect(result.passenger_meta.first_name).toBe('Luis');
      expect(result.passenger_meta.school).toBe('Ing. Sistemas');
      expect(result.passenger_meta.cycle).toBe(5);
    });

    it('should use "Estudiante" as first_name when passenger meta has no full_name', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 1 });
      const newRequest = makeRequest();
      mockQuery
        .mockResolvedValueOnce({ rows: [route] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newRequest] })
        .mockResolvedValueOnce({ rows: [{ full_name: null, academic_cycle: null, school_name: null }] });

      const result = await service.requestSeat(routeId, passengerId);
      expect(result.passenger_meta.first_name).toBe('Estudiante');
    });

    it('should use "Comunidad" as school when passenger meta has no school_name', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 1 });
      const newRequest = makeRequest();
      mockQuery
        .mockResolvedValueOnce({ rows: [route] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newRequest] })
        .mockResolvedValueOnce({ rows: [{ full_name: null, academic_cycle: null, school_name: null }] });

      const result = await service.requestSeat(routeId, passengerId);
      expect(result.passenger_meta.school).toBe('Comunidad');
    });

    it('should use cycle=1 as default when academic_cycle is null', async () => {
      const route = makeRoute({ driver_id: driverId, available_seats: 1 });
      const newRequest = makeRequest();
      mockQuery
        .mockResolvedValueOnce({ rows: [route] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newRequest] })
        .mockResolvedValueOnce({ rows: [{ full_name: null, academic_cycle: null, school_name: null }] });

      const result = await service.requestSeat(routeId, passengerId);
      expect(result.passenger_meta.cycle).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // confirmSeat()
  // ════════════════════════════════════════════════════════════════════

  describe('confirmSeat()', () => {
    const routeId = 'route-uuid-0001';
    const driverId = 'driver-uuid-0001';
    const passengerId = 'passenger-uuid-0001';

    const buildMockClient = () => ({
      query: jest.fn(),
      release: jest.fn(),
    });

    const makeConfirmClient = (
      routeOverride?: Partial<CarpoolingRoute>,
      requestOverride?: Partial<CarpoolingRequest>,
      driverContact = makeContact(),
      passengerContact = makeContact({ full_name: 'Ana Torres' })
    ) => {
      const client = buildMockClient();
      const route = makeRoute({ driver_id: driverId, available_seats: 1, ...routeOverride });
      const request = makeRequest({ status: 'SEAT_REQUESTED', ...requestOverride });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [route] }) // route lock
        .mockResolvedValueOnce({ rows: [request] }) // request lock
        .mockResolvedValueOnce(undefined) // UPDATE request status
        .mockResolvedValueOnce(undefined) // UPDATE available_seats
        .mockResolvedValueOnce({ rows: [driverContact] }) // driver contact
        .mockResolvedValueOnce({ rows: [passengerContact] }) // passenger contact
        .mockResolvedValueOnce(undefined); // COMMIT
      return client;
    };

    it('should throw AppError 404 ERR_CARPOOLING_ROUTE_NOT_FOUND on ROUTE_NOT_FOUND error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // route not found
        .mockResolvedValueOnce(undefined); // ROLLBACK
      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_CARPOOLING_ROUTE_NOT_FOUND',
      });
    });

    it('should throw AppError 403 ERR_CARPOOLING_FORBIDDEN on NOT_ROUTE_DRIVER error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      const route = makeRoute({ driver_id: 'another-driver', available_seats: 1 });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [route] }) // route found, wrong driver
        .mockResolvedValueOnce(undefined); // ROLLBACK
      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'ERR_CARPOOLING_FORBIDDEN',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_NO_SEATS on NO_SEATS_AVAILABLE error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      const route = makeRoute({ driver_id: driverId, available_seats: 0 });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [route] }) // route with no seats
        .mockResolvedValueOnce(undefined); // ROLLBACK
      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_NO_SEATS',
      });
    });

    it('should throw AppError 404 ERR_CARPOOLING_REQUEST_NOT_FOUND on REQUEST_NOT_FOUND error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [route] }) // route ok
        .mockResolvedValueOnce({ rows: [] }) // request not found
        .mockResolvedValueOnce(undefined); // ROLLBACK
      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_CARPOOLING_REQUEST_NOT_FOUND',
      });
    });

    it('should throw AppError 400 ERR_CARPOOLING_INVALID_STATE on INVALID_REQUEST_STATUS error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      const route = makeRoute({ driver_id: driverId, available_seats: 2 });
      const confirmedRequest = makeRequest({ status: 'SEAT_CONFIRMED' });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [route] })
        .mockResolvedValueOnce({ rows: [confirmedRequest] }) // already confirmed
        .mockResolvedValueOnce(undefined); // ROLLBACK
      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_CARPOOLING_INVALID_STATE',
      });
    });

    it('should return confirmation data with driver and passenger contacts on success', async () => {
      const client = makeConfirmClient();
      mockConnect.mockResolvedValueOnce(client);

      const result = await service.confirmSeat(routeId, driverId, passengerId);
      expect(result.route_id).toBe(routeId);
      expect(result.status).toBe('SEAT_CONFIRMED');
      expect(result.driver_contact).toBeDefined();
      expect(result.passenger_contact).toBeDefined();
      expect(result.driver_contact.full_name).toBe('Juan Pérez');
    });

    it('should propagate unknown errors not mapped to AppError', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Unknown DB error'));

      await expect(service.confirmSeat(routeId, driverId, passengerId)).rejects.toThrow('Unknown DB error');
    });

    it('should release the client in the finally block on success', async () => {
      const client = makeConfirmClient();
      mockConnect.mockResolvedValueOnce(client);
      await service.confirmSeat(routeId, driverId, passengerId);
      expect(client.release).toHaveBeenCalled();
    });

    it('should release the client in the finally block on error', async () => {
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Crash'));
      await service.confirmSeat(routeId, driverId, passengerId).catch(() => {});
      expect(client.release).toHaveBeenCalled();
    });
  });
});
