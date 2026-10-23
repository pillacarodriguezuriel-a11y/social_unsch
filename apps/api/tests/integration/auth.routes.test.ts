/**
 * Integration Test Suite: Auth HTTP Routes
 *
 * Strategy: Black-box HTTP testing via supertest against the real Express app instance.
 * - Infrastructure dependencies (pg pool, ioredis, JWT keys) are mocked at module level.
 * - The actual Express middleware stack (helmet, cors, Zod validation, errorMiddleware) runs normally.
 * - Tests assert HTTP status codes, JSON response structure, and error code fields.
 *
 * Routes under test:
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 *   GET  /api/v1/auth/profile-me  (requireAuth middleware)
 */

// ─── Module Mocks ─────────────────────────────────────────────────────────────

// Prevent ioredis from attempting a real TCP connection on startup
// Prevent pg from opening a real database connection
jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock bcrypt to eliminate I/O and timing overhead in integration tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$integrationHashMock'),
  compare: jest.fn(),
}));

// Mock JWT utilities — in integration tests we control token validity explicitly
jest.mock('../../src/config/jwt', () => ({
  signAccessToken: jest.fn().mockReturnValue('mock.integration.jwt.token'),
  verifyAccessToken: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import request from 'supertest';
import bcrypt from 'bcrypt';
import { pool } from '../../src/config/database';
import { verifyAccessToken } from '../../src/config/jwt';
import { createTestApp } from '../helpers/test-app';

const app = createTestApp();
import { User } from '../../src/modules/auth/auth.repository';
import { TokenPayload } from '../../src/config/jwt';

// ─── Typed mock references ────────────────────────────────────────────────────

const mockQuery = pool.query as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockVerifyAccessToken = verifyAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserRow: User = {
  id: 'c5e2b3d1-abcd-4ef0-8123-000000000099',
  full_name: 'Ana Lucia Quispe Flores',
  email: 'a.quispe@unsch.edu.pe',
  password_hash: '$2b$12$storedHashedPassword',
  role: 'student',
  professional_school_id: 5,
  faculty_id: 2,
  current_academic_cycle: 6,
  credits_balance: 200,
  has_accepted_terms: true,
  created_at: new Date('2025-04-01T00:00:00Z'),
  updated_at: new Date('2025-04-01T00:00:00Z'),
};

const mockDecodedPayload: TokenPayload = {
  jti: 'test-jti-uuid',
  user_id: mockUserRow.id,
  role: 'student',
  school_id: 5,
  has_accepted_terms: true,
  facultad_id: 2,
  escuela_id: 5,
  ciclo: 6,
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Auth HTTP Routes — Integration', () => {
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/v1/auth/register
  // ════════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/auth/register', () => {
    const validRegisterBody = {
      full_name: 'Maria Elena Torres',
      email: 'm.torres@unsch.edu.pe',
      password: 'Secure123!',
      role: 'student',
      professional_school_id: 3,
      current_academic_cycle: 4,
    };

    it('should return 201 and success payload when input is valid and email is new', async () => {
      // findByEmail → no existing user
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // create → returns new user row
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, email: 'm.torres@unsch.edu.pe', id: 'new-uuid-9999' }],
        rowCount: 1,
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Usuario registrado exitosamente.');
      expect(response.body.user_id).toBeDefined();
    });

    it('should return 400 when email does not belong to the @unsch.edu.pe domain (Zod validation)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, email: 'usuario@gmail.com' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      // Zod throws a ZodError which is handled by the errorMiddleware
      expect(response.body).toBeDefined();
    });

    it('should return 400 when password does not meet complexity requirements', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, password: 'simple' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should reject role "administrator" from public registration with 400 error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, role: 'administrator' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Los roles administrativos no pueden ser autoasignados');
    });

    it('should reject unknown role with 400 error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, role: 'superadmin' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when full_name is missing', async () => {
      const { full_name, ...bodyWithoutName } = validRegisterBody;

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(bodyWithoutName)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 with ERR_AUTH_EMAIL_EXISTS when email is already registered', async () => {
      // findByEmail → user already exists
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, email: mockUserRow.email })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ERR_AUTH_EMAIL_EXISTS');
    });

    it('should return 400 when role is not a valid enum value', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterBody, role: 'superadmin' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/v1/auth/login
  // ════════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/auth/login', () => {
    const validLoginBody = {
      email: mockUserRow.email,
      password: 'SecurePass1!',
    };

    it('should return 200 with access_token and user object on valid credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      mockBcryptCompare.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginBody)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBe('mock.integration.jwt.token');
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(86400);

      // Verify user shape in response
      expect(response.body.user).toMatchObject({
        id: mockUserRow.id,
        email: mockUserRow.email,
        role: 'student',
        credits_balance: 200,
      });
    });

    it('should return 401 with ERR_AUTH_INVALID_CREDENTIALS when user does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@unsch.edu.pe', password: 'AnyPass1!' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
    });

    it('should return 401 with ERR_AUTH_INVALID_CREDENTIALS when password is incorrect', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      mockBcryptCompare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ ...validLoginBody, password: 'WrongPass99!' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
    });

    it('should return 400 when email does not match institutional domain on login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@hotmail.com', password: 'AnyPass1!' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should return 400 when request body is completely empty', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/v1/auth/profile-me  (requireAuth middleware)
  // ════════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/auth/profile-me', () => {
    it('should return 200 and decoded user payload when Bearer token is valid', async () => {
      mockVerifyAccessToken.mockReturnValueOnce(mockDecodedPayload);

      const response = await request(app)
        .get('/api/v1/auth/profile-me')
        .set('Authorization', 'Bearer mock.integration.jwt.token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toMatchObject({
        user_id: mockUserRow.id,
        role: 'student',
      });
    });

    it('should return 401 ERR_AUTH_TOKEN_MISSING when Authorization header is absent', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile-me');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN when Authorization header has wrong format', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile-me')
        .set('Authorization', 'InvalidFormat tokenhere');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });

    it('should return 401 ERR_AUTH_TOKEN_EXPIRED when token has expired', async () => {
      // Simulate jsonwebtoken throwing a TokenExpiredError
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      mockVerifyAccessToken.mockImplementationOnce(() => { throw expiredError; });

      const response = await request(app)
        .get('/api/v1/auth/profile-me')
        .set('Authorization', 'Bearer expired.token.here');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_TOKEN_EXPIRED');
    });

    it('should return 401 ERR_AUTH_INVALID_TOKEN when token signature is tampered', async () => {
      // Simulate jsonwebtoken throwing a JsonWebTokenError
      const invalidError = new Error('invalid signature');
      invalidError.name = 'JsonWebTokenError';
      mockVerifyAccessToken.mockImplementationOnce(() => { throw invalidError; });

      const response = await request(app)
        .get('/api/v1/auth/profile-me')
        .set('Authorization', 'Bearer tampered.token.here');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Error Middleware — catch-all 500 path (lines 42-45 of error.middleware.ts)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Error Middleware — 500 Internal Server Error path', () => {
    it('should return 500 ERR_SERVER_INTERNAL_ERROR when an unexpected error propagates to errorMiddleware', async () => {
      // Trigger an unexpected error (not AppError, not ZodError) by making
      // pool.query throw a plain Error. The controller catches it and calls next(error),
      // which routes to the catch-all branch of errorMiddleware.
      mockQuery.mockRejectedValueOnce(new Error('Unexpected database connection failure'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUserRow.email, password: 'AnyPass1!' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
      expect(response.body.message).toBe(
        'Ha ocurrido un error interno en el servidor. Inténtelo más tarde.'
      );
    });
  });
});
