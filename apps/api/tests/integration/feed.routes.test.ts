/**
 * Integration Test Suite: Feed HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest against the real Express app.
 * - Infrastructure mocked (pg pool, ioredis, JWT).
 * - Tests assert HTTP status codes and JSON structure.
 *
 * Routes under test:
 *   GET  /api/v1/feed
 *   POST /api/v1/feed
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
import { pool } from '../../src/config/database';
import { verifyAccessToken } from '../../src/config/jwt';
import { createTestApp } from '../helpers/test-app';

const app = createTestApp();
import { TokenPayload } from '../../src/config/jwt';

const mockQuery = pool.query as jest.Mock;
const mockVerify = verifyAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const authPayload: TokenPayload = {
  jti: 'jti-feed-test',
  user_id: 'user-feed-uuid-0001',
  role: 'student',
  school_id: 3,
  has_accepted_terms: true,
  facultad_id: 1,
  escuela_id: 3,
  ciclo: 6,
};

const mockPost = {
  id: 'post-uuid-0001',
  user_id: authPayload.user_id,
  faculty_id: 1,
  professional_school_id: 3,
  content: 'Contenido de prueba académica',
  is_visible: true,
  created_at: new Date().toISOString(),
  author_name: 'Maria Torres',
  author_role: 'student',
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feed HTTP Routes — Integration', () => {

  // ════════════════════════════════════════════════════════════════════
  // GET /api/v1/feed
  // ════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/feed', () => {

    it('should return 200 with a data array when authenticated', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockPost, { ...mockPost, id: 'post-uuid-0002' }] });

      const response = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 200 with empty data array when no posts exist', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 200 when faculty_id filter is provided as valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });

      const response = await request(app)
        .get('/api/v1/feed?faculty_id=1')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });

    it('should return 200 when school_id filter is provided as valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/feed?school_id=3')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });

    it('should return 200 with pagination parameters page and limit', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/feed?page=2&limit=10')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(200);
    });

    it('should return 400 when faculty_id is not a valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .get('/api/v1/feed?faculty_id=abc')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when school_id is not a valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .get('/api/v1/feed?school_id=xyz')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
    });

    it('should return 400 when page is not a valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .get('/api/v1/feed?page=notanumber')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
    });

    it('should return 400 when limit is not a valid number', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .get('/api/v1/feed?limit=nan')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(400);
    });

    it('should return 401 when no Authorization header is present', async () => {
      const response = await request(app).get('/api/v1/feed');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_TOKEN_EXPIRED when token is expired', async () => {
      const expired = new Error('jwt expired');
      expired.name = 'TokenExpiredError';
      mockVerify.mockImplementationOnce(() => { throw expired; });

      const response = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', 'Bearer expired.token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_EXPIRED');
    });

    it('should return 500 when database throws unexpectedly', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // POST /api/v1/feed
  // ════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/feed', () => {
    const validBody = { content: 'Nuevo anuncio académico de prueba' };

    it('should return 201 with post_id on successful post creation', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...mockPost, id: 'new-post-001' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] }); // author

      const response = await request(app)
        .post('/api/v1/feed')
        .send(validBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.post_id).toBeDefined();
    });

    it('should return 400 ERR_VALIDATION_INVALID_FIELDS when content is empty', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ content: '' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when content is only whitespace', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ content: '    ' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when content exceeds 2000 characters', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ content: 'A'.repeat(2001) })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when faculty_id is non-numeric', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ ...validBody, faculty_id: 'not-a-number' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should return 400 when school_id is non-numeric', async () => {
      mockVerify.mockReturnValueOnce(authPayload);

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ ...validBody, school_id: 'invalid' })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING when no auth token is provided', async () => {
      const response = await request(app)
        .post('/api/v1/feed')
        .send(validBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN when token format is wrong', async () => {
      const response = await request(app)
        .post('/api/v1/feed')
        .send(validBody)
        .set('Authorization', 'Token bad-format')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 201 with faculty_id and school_id when both are valid numbers', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...mockPost, faculty_id: 1, professional_school_id: 3, id: 'new-post-002' }] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });

      const response = await request(app)
        .post('/api/v1/feed')
        .send({ ...validBody, faculty_id: 1, school_id: 3 })
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
    });

    it('should return 500 on unexpected database error', async () => {
      mockVerify.mockReturnValueOnce(authPayload);
      mockQuery.mockRejectedValueOnce(new Error('DB crashed'));

      const response = await request(app)
        .post('/api/v1/feed')
        .send(validBody)
        .set('Authorization', 'Bearer valid.token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
    });
  });
});
