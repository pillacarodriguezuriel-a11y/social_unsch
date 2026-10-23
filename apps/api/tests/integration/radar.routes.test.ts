/**
 * Integration Test Suite: Radar HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest.
 * - Infrastructure (ioredis, pg pool, JWT) mocked at module level.
 * - Tests assert HTTP status codes and JSON response shape.
 *
 * Routes under test:
 *   GET  /api/v1/radar/status
 *   POST /api/v1/radar/report
 */

// ─── Module Mocks ─────────────────────────────────────────────────────────────

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../src/config/jwt', () => ({
  signAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import request from 'supertest';
import { verifyAccessToken } from '../../src/config/jwt';
import { createFakeRedis, createTestApp } from '../helpers/test-app';

// Cliente Redis falso inyectado en el módulo de radar (composición explícita)
const redis = createFakeRedis();
const app = createTestApp({ redis });
import { TokenPayload } from '../../src/config/jwt';

const mockPipeline = redis.pipeline as jest.Mock;
const mockEval = redis.eval as jest.Mock;
const mockVerify = verifyAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const authPayload: TokenPayload = {
  jti: 'jti-radar-test',
  user_id: 'user-radar-uuid-0001',
  role: 'student',
  school_id: 3,
  has_accepted_terms: true,
  facultad_id: 1,
  escuela_id: 3,
  ciclo: 6,
};

// Helper: build a mock pipeline
const buildPipeline = (results: Array<[null, Record<string, string> | null]>) => ({
  hgetall: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(results),
});

const fullRadarData: Array<[null, Record<string, string>]> = [
  [null, { status: 'fluid', report_count: '4' }],
  [null, { status: 'empty_window', report_count: '3' }],
  [null, { occupancy: '60', report_count: '5' }],
  [null, { occupancy: '40', report_count: '2' }],
  [null, { occupancy: '80', report_count: '6' }],
  [null, { occupancy: '20', report_count: '1' }],
  [null, { status: 'class_suspended', report_count: '3' }],
];

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Radar HTTP Routes — Integration', () => {

  // ════════════════════════════════════════════════════════════════════
  // GET /api/v1/radar/status
  // ════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/radar/status', () => {

    it('should return 200 with full radar status when all nodes have data', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockPipeline.mockReturnValueOnce(buildPipeline(fullRadarData));

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.comedor).toBeDefined();
      expect(response.body.rectorado).toBeDefined();
      expect(response.body.biblioteca).toBeDefined();
      expect(response.body.campus_alert).toBeDefined();
    });

    it('should return 200 with is_definite=false when Redis has no data', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockPipeline.mockReturnValueOnce(buildPipeline(Array(7).fill([null, null])));

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.comedor.is_definite).toBe(false);
      expect(response.body.comedor.status).toBe('indefinido');
    });

    it('should return correct comedor status from Redis', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockPipeline.mockReturnValueOnce(buildPipeline(fullRadarData));

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer valid.token');

      expect(response.body.comedor.status).toBe('fluid');
      expect(response.body.comedor.is_definite).toBe(true);
    });

    it('should return correct biblioteca floor occupancy as number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockPipeline.mockReturnValueOnce(buildPipeline(fullRadarData));

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer valid.token');

      expect(typeof response.body.biblioteca.floor_1.occupancy).toBe('number');
      expect(response.body.biblioteca.floor_1.occupancy).toBe(60);
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app).get('/api/v1/radar/status');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN with malformed token', async () => {
      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Basic not-valid');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 401 ERR_AUTH_TOKEN_EXPIRED when token is expired', async () => {
      const expired = new Error('jwt expired');
      expired.name = 'TokenExpiredError';
      mockVerify.mockImplementationOnce(() => { throw expired; });

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer expired.token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_EXPIRED');
    });

    it('should return 500 when Redis pipeline throws an error', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const failingPipeline = {
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // returns null → triggers error
      };
      mockPipeline.mockReturnValueOnce(failingPipeline);

      const response = await request(app)
        .get('/api/v1/radar/status')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(500);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // POST /api/v1/radar/report
  // ════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/radar/report', () => {
    const validComedorBody = { node: 'comedor', status: 'fluid' };

    it('should return 200 updated=true when report reaches threshold', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockEval.mockResolvedValueOnce([1, 3, 'Estado actualizado']);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send(validComedorBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.updated).toBe(true);
    });

    it('should return 200 updated=false when report does not reach threshold', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send(validComedorBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.updated).toBe(false);
      expect(response.body.votes_required).toBe(3);
    });

    it('should return 400 ERR_RADAR_INVALID_NODE when node is invalid', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'cafeteria', status: 'fluid' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_RADAR_INVALID_NODE');
    });

    it('should return 400 ERR_RADAR_INVALID_STATUS when comedor status is invalid', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'comedor', status: 'super_packed' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_RADAR_INVALID_STATUS');
    });

    it('should return 400 ERR_RADAR_INVALID_STATUS when biblioteca occupancy is out of range', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'biblioteca_floor_1', status: '150' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_RADAR_INVALID_STATUS');
    });

    it('should return 400 ERR_RADAR_INVALID_STATUS when biblioteca occupancy is NaN', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'biblioteca_floor_2', status: 'alta' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_RADAR_INVALID_STATUS');
    });

    it('should return 400 ERR_RADAR_INVALID_STATUS when rectorado status is invalid', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'rectorado', status: 'open' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_RADAR_INVALID_STATUS');
    });

    it('should return 400 ERR_VALIDATION_INVALID_FIELDS when node is missing', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ status: 'fluid' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 ERR_VALIDATION_INVALID_FIELDS when status is missing', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'comedor' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when body is empty', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({})
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app)
        .post('/api/v1/radar/report')
        .send(validComedorBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN with tampered token', async () => {
      const invalid = new Error('invalid signature');
      invalid.name = 'JsonWebTokenError';
      mockVerify.mockImplementationOnce(() => { throw invalid; });

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send(validComedorBody)
        .set('Authorization', 'Bearer tampered.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should accept valid campus_alert status "class_suspended"', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'campus_alert', status: 'class_suspended' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should accept valid biblioteca_floor_3 occupancy "75"', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockEval.mockResolvedValueOnce([0, 2, 'Reporte registrado']);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send({ node: 'biblioteca_floor_3', status: '75' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should return 200 updated=false when user already voted (votesCount=-1)', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockEval.mockResolvedValueOnce([0, -1, 'Ya reportaste este estado en la ventana actual']);

      const response = await request(app)
        .post('/api/v1/radar/report')
        .send(validComedorBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.updated).toBe(false);
    });
  });
});
