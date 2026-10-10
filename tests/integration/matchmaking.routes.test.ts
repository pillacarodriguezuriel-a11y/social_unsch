/**
 * Integration Test Suite: Matchmaking HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest.
 * - Infrastructure (pg pool, ioredis, JWT) mocked at module level.
 * - Tests assert HTTP status codes and JSON shape.
 *
 * Routes under test:
 *   POST /api/v1/matchmaking/score
 *   GET  /api/v1/matchmaking/profiles
 *   POST /api/v1/matchmaking/interact
 */

// ─── Module Mocks ─────────────────────────────────────────────────────────────

jest.mock('../../src/config/redis', () => ({
  redis: { on: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

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
import app from '../../src/app';
import { TokenPayload } from '../../src/config/jwt';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockVerify = verifyAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const authPayload: TokenPayload = {
  jti: 'jti-matchmaking-test',
  user_id: 'user-mm-uuid-0001',
  role: 'student',
  school_id: 3,
  has_accepted_terms: true,
  facultad_id: 1,
  escuela_id: 3,
  ciclo: 6,
};

const validProjectId = 'a1b2c3d4-1234-4abc-9def-000000000001';
const validProfileId = 'b2c3d4e5-2345-4bcd-9ef0-000000000002';

const mockProject = {
  id: validProjectId,
  owner_id: 'owner-uuid',
  faculty_id: 1,
  title: 'Proyecto ML',
  description: 'Machine Learning research',
  project_type: 'investigacion',
  skills_offered: ['Python'],
  skills_needed: ['Machine Learning', 'TensorFlow'],
  max_members: 5,
  current_members: 2,
  is_open: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockProfile = {
  id: validProfileId,
  user_id: 'other-user-uuid',
  project_type: 'investigacion',
  description: 'Estudiante UNSCH',
  is_visible: true,
  created_at: new Date().toISOString(),
  full_name: 'Ana Quispe',
  role: 'student',
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Matchmaking HTTP Routes — Integration', () => {

  // ════════════════════════════════════════════════════════════════════
  // POST /api/v1/matchmaking/score
  // ════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/matchmaking/score', () => {
    const validBody = { project_id: validProjectId, user_skills: ['Machine Learning', 'Python'] };

    it('should return 200 with affinity score on valid input', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockProject], rowCount: 1 });

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send(validBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.affinity_score).toBeDefined();
      expect(response.body.affinity_level).toBeDefined();
      expect(response.body.matched_skills).toBeDefined();
      expect(response.body.missing_skills).toBeDefined();
    });

    it('should return 400 ERR_VALIDATION_INVALID_FIELDS when project_id is not a valid UUID', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ project_id: 'not-a-uuid', user_skills: ['Python'] })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when user_skills array is empty', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ project_id: validProjectId, user_skills: [] })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when user_skills is missing', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ project_id: validProjectId })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when project_id is missing', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ user_skills: ['Python'] })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 404 ERR_FEED_POST_NOT_FOUND when project does not exist', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send(validBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_FEED_POST_NOT_FOUND');
    });

    it('should return 404 when project is closed', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [{ ...mockProject, is_open: false }], rowCount: 1 });

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send(validBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send(validBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return correct affinity_level "Alta" when all skills match', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const project = { ...mockProject, skills_needed: ['Machine Learning', 'TensorFlow'] };
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ project_id: validProjectId, user_skills: ['Machine Learning', 'TensorFlow'] })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.affinity_level).toBe('Alta');
    });

    it('should return affinity_level "Baja" when no skills match', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockProject], rowCount: 1 });

      const response = await request(app)
        .post('/api/v1/matchmaking/score')
        .send({ project_id: validProjectId, user_skills: ['Java', 'C++'] })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.affinity_level).toBe('Baja');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // GET /api/v1/matchmaking/profiles
  // ════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/matchmaking/profiles', () => {

    it('should return 200 with data array when authenticated', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockProfile] });

      const response = await request(app)
        .get('/api/v1/matchmaking/profiles')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 200 with empty data when no profiles exist', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/matchmaking/profiles')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/v1/matchmaking/profiles');

      expect(response.status).toBe(401);
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN with malformed token', async () => {
      const response = await request(app)
        .get('/api/v1/matchmaking/profiles')
        .set('Authorization', 'InvalidScheme token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // POST /api/v1/matchmaking/interact
  // ════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/matchmaking/interact', () => {
    const validLikeBody = { receiver_profile_id: validProfileId, action: 'like' };
    const validDislikeBody = { receiver_profile_id: validProfileId, action: 'dislike' };

    const buildMockClient = () => ({
      query: jest.fn(),
      release: jest.fn(),
    });

    it('should return 200 with match=false and status=pending on a like (no reverse)', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: validProfileId, user_id: 'other-user' }] })
        .mockResolvedValueOnce({ rows: [] }) // sender profile
        .mockResolvedValueOnce({ rows: [] }) // no reverse
        .mockResolvedValueOnce(undefined) // INSERT pending
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validLikeBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.match).toBe(false);
      expect(response.body.status).toBe('pending');
    });

    it('should return 200 with match=false and status=rejected on a dislike', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: validProfileId, user_id: 'other-user' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // no reverse
        .mockResolvedValueOnce(undefined) // INSERT rejected
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validDislikeBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.match).toBe(false);
      expect(response.body.status).toBe('rejected');
    });

    it('should return 200 with match=true when double-match occurs', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getMatchedContactInfo

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: validProfileId, user_id: 'other-user' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'sender-profile' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'reverse-int', status: 'pending' }] }) // reverse found
        .mockResolvedValueOnce(undefined) // UPDATE reverse
        .mockResolvedValueOnce(undefined) // INSERT accepted
        .mockResolvedValueOnce(undefined) // UPDATE visibility
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validLikeBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.match).toBe(true);
      expect(response.body.status).toBe('accepted');
    });

    it('should return 400 ERR_VALIDATION_INVALID_FIELDS when receiver_profile_id is not UUID', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send({ receiver_profile_id: 'not-a-uuid', action: 'like' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when action is invalid (not like or dislike)', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send({ receiver_profile_id: validProfileId, action: 'super' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when receiver_profile_id is missing', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send({ action: 'like' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 404 ERR_FEED_POST_NOT_FOUND when profile does not exist', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // profile not found
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validLikeBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_FEED_POST_NOT_FOUND');
    });

    it('should return 400 ERR_MOD_SELF_REPORT when user tries to like themselves', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      const client = buildMockClient();
      mockConnect.mockResolvedValueOnce(client);
      // receiver profile belongs to the same user
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: validProfileId, user_id: authPayload.user_id }] }) // same user
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validLikeBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_MOD_SELF_REPORT');
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING without token', async () => {
      const response = await request(app)
        .post('/api/v1/matchmaking/interact')
        .send(validLikeBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });
  });
});
