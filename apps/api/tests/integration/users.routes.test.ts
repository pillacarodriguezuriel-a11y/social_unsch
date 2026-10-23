/**
 * Integration Test Suite: Users HTTP Routes
 *
 * Strategy: Black-box HTTP via supertest.
 * - pg pool, ioredis, and JWT mocked at module level.
 * - Tests assert HTTP status codes, JSON response structure.
 *
 * Routes under test:
 *   PATCH /api/v1/users/accept-terms
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

const userId = 'user-uuid-terms-0001';

const validPayload: TokenPayload = {
  jti: 'jti-uuid-terms',
  user_id: userId,
  role: 'student',
  school_id: 3,
  has_accepted_terms: false,
  facultad_id: 1,
  escuela_id: 3,
  ciclo: 6,
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Users HTTP Routes — Integration', () => {

  describe('PATCH /api/v1/users/accept-terms', () => {

    it('should return 200 when user exists and terms are accepted successfully', async () => {
      mockVerify.mockReturnValueOnce(validPayload);
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 });

      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Bearer valid.token.here');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 with ERR_USER_NOT_FOUND when user does not exist', async () => {
      mockVerify.mockReturnValueOnce(validPayload);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Bearer valid.token.here');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ERR_USER_NOT_FOUND');
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING when Authorization header is absent', async () => {
      const response = await request(app)
        .patch('/api/v1/users/accept-terms');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN when token format is wrong', async () => {
      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Basic some-token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 401 ERR_AUTH_TOKEN_EXPIRED when token is expired', async () => {
      const expired = new Error('jwt expired');
      expired.name = 'TokenExpiredError';
      mockVerify.mockImplementationOnce(() => { throw expired; });

      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Bearer expired.token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_EXPIRED');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN when token signature is tampered', async () => {
      const invalid = new Error('invalid signature');
      invalid.name = 'JsonWebTokenError';
      mockVerify.mockImplementationOnce(() => { throw invalid; });

      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Bearer tampered.token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 500 ERR_SERVER_INTERNAL_ERROR on unexpected DB failure', async () => {
      mockVerify.mockReturnValueOnce(validPayload);
      mockQuery.mockRejectedValueOnce(new Error('DB unavailable'));

      const response = await request(app)
        .patch('/api/v1/users/accept-terms')
        .set('Authorization', 'Bearer valid.token');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
    });
  });
});
