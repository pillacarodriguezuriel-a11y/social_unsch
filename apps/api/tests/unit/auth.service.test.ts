/**
 * Unit Test Suite: AuthService
 *
 * Strategy: Full isolation via jest.mock().
 * - The pg pool is mocked at module level so no real DB connection is attempted.
 * - bcrypt is mocked to control hash/compare outcomes deterministically.
 * - signAccessToken (jwt wrapper) is mocked to return a predictable token string.
 *
 * Coverage targets:
 *   AuthService.register  → happy path, duplicate email
 *   AuthService.login     → happy path, user not found, wrong password
 */

// ─── Module Mocks (must be at the top, before any imports) ───────────────────

// Mock the pg pool so AuthRepository never touches a real database
jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock bcrypt to avoid expensive hashing during unit tests
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock the JWT signing utility to return a deterministic token
jest.mock('../../src/config/jwt', () => ({
  signAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

// ─── Imports (after mocks are registered) ────────────────────────────────────

import bcrypt from 'bcrypt';
import { pool } from '../../src/config/database';
import { signAccessToken } from '../../src/config/jwt';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { AppError } from '../../src/shared/errors/AppError';
import { User } from '../../src/modules/auth/auth.repository';

// ─── Typed mock references ────────────────────────────────────────────────────

const mockQuery = pool.query as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockSignAccessToken = signAccessToken as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A complete User row as it would be returned from the PostgreSQL database.
 * Every field maps directly to the User interface in auth.repository.ts.
 */
const mockUserRow: User = {
  id: 'b3f1a2c4-1234-4abc-9def-000000000001',
  full_name: 'Uriel Pillacaro Rodriguez',
  email: 'u.pillacaro@unsch.edu.pe',
  password_hash: '$2b$12$hashedPasswordMockValue',
  role: 'student',
  professional_school_id: 3,
  faculty_id: 1,
  current_academic_cycle: 8,
  credits_balance: 150,
  has_accepted_terms: true,
  created_at: new Date('2025-03-01T00:00:00Z'),
  updated_at: new Date('2025-03-01T00:00:00Z'),
};

const MOCK_JWT_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.mockPayload.mockSignature';
const HASHED_PASSWORD = '$2b$12$newHashGeneratedByMock';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AuthService.register
  // ══════════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    const registerInput = {
      full_name: 'Uriel Pillacaro Rodriguez',
      email: 'u.pillacaro@unsch.edu.pe',
      password_hash: 'SecurePass1!',
      role: 'student' as const,
      professional_school_id: 3,
      current_academic_cycle: 8,
    };

    it('should register a new user successfully when the email does not exist', async () => {
      // findByEmail → returns null (email is available)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // bcrypt.hash → returns a predictable hash
      mockBcryptHash.mockResolvedValueOnce(HASHED_PASSWORD);
      // authRepository.create → returns the newly created user row
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUserRow, password_hash: HASHED_PASSWORD }],
        rowCount: 1,
      });

      const result = await authService.register(registerInput);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Usuario registrado exitosamente.');
      expect(result.user_id).toBe(mockUserRow.id);
      // Ensure bcrypt.hash was called with the plain password and 12 salt rounds
      expect(mockBcryptHash).toHaveBeenCalledWith('SecurePass1!', 12);
    });

    it('should throw AppError 400 ERR_AUTH_EMAIL_EXISTS when the email is already registered', async () => {
      // findByEmail → returns an existing user row (email already taken)
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      await expect(authService.register(registerInput)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_AUTH_EMAIL_EXISTS',
        message: 'Este correo electrónico ya se encuentra registrado en el sistema.',
      });

      // bcrypt.hash must NOT be called — we should abort before hashing
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should throw an AppError instance (not a plain Error) when email exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const error = await authService.register(registerInput).catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
    });

    it('should reject registration attempt with role "administrator" with 403 ERR_AUTH_FORBIDDEN_ROLE', async () => {
      await expect(
        authService.register({ ...registerInput, role: 'administrator' as any })
      ).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'ERR_AUTH_FORBIDDEN_ROLE',
      });

      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should reject registration attempt with invalid role with 400 ERR_AUTH_INVALID_ROLE', async () => {
      await expect(
        authService.register({ ...registerInput, role: 'unknown_role' as any })
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_AUTH_INVALID_ROLE',
      });

      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AuthService.login
  // ══════════════════════════════════════════════════════════════════════════════

  describe('login()', () => {
    const PLAIN_PASSWORD = 'SecurePass1!';

    it('should return access_token and user object when credentials are valid', async () => {
      // findByEmail → returns the user row
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      // bcrypt.compare → password matches
      mockBcryptCompare.mockResolvedValueOnce(true);
      // signAccessToken → returns the mock JWT
      mockSignAccessToken.mockReturnValueOnce(MOCK_JWT_TOKEN);

      const result = await authService.login(mockUserRow.email, PLAIN_PASSWORD);

      // Token structure assertions
      expect(result.access_token).toBe(MOCK_JWT_TOKEN);
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(86400);

      // User object structure assertions
      expect(result.user.id).toBe(mockUserRow.id);
      expect(result.user.email).toBe(mockUserRow.email);
      expect(result.user.full_name).toBe(mockUserRow.full_name);
      expect(result.user.role).toBe('student');
      expect(result.user.credits_balance).toBe(150);
      expect(result.user.has_accepted_terms).toBe(true);

      // JWT signing was called with the correct payload shape
      expect(mockSignAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserRow.id,
          role: 'student',
          school_id: mockUserRow.professional_school_id,
          has_accepted_terms: true,
        }),
        { expiresIn: '24h' }
      );
    });

    it('should throw AppError 401 ERR_AUTH_INVALID_CREDENTIALS when user is not found', async () => {
      // findByEmail → returns null (user does not exist)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        authService.login('nonexistent@unsch.edu.pe', PLAIN_PASSWORD)
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'ERR_AUTH_INVALID_CREDENTIALS',
        message: 'Las credenciales ingresadas son incorrectas.',
      });

      // bcrypt.compare must NOT be called — user not found short-circuits
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(mockSignAccessToken).not.toHaveBeenCalled();
    });

    it('should throw AppError 401 ERR_AUTH_INVALID_CREDENTIALS when password is wrong', async () => {
      // findByEmail → user exists
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      // bcrypt.compare → password does NOT match
      mockBcryptCompare.mockResolvedValueOnce(false);

      await expect(
        authService.login(mockUserRow.email, 'WrongPassword99!')
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'ERR_AUTH_INVALID_CREDENTIALS',
        message: 'Las credenciales ingresadas son incorrectas.',
      });

      // signAccessToken must NOT be called — abort before token generation
      expect(mockSignAccessToken).not.toHaveBeenCalled();
    });

    it('should use generic error message for both user-not-found and wrong-password (security: no account enumeration)', async () => {
      // Case A: user not found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const errorA = await authService.login('ghost@unsch.edu.pe', PLAIN_PASSWORD).catch((e) => e);

      // Case B: wrong password
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      mockBcryptCompare.mockResolvedValueOnce(false);
      const errorB = await authService.login(mockUserRow.email, 'Wrong1!').catch((e) => e);

      // Both must return the exact same message to prevent account enumeration attacks
      expect(errorA.message).toBe(errorB.message);
      expect(errorA.statusCode).toBe(errorB.statusCode);
      expect(errorA.errorCode).toBe(errorB.errorCode);
    });

    it('should include facultad_id and escuela_id in the JWT payload (data redundancy check)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockSignAccessToken.mockReturnValueOnce(MOCK_JWT_TOKEN);

      await authService.login(mockUserRow.email, PLAIN_PASSWORD);

      expect(mockSignAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          facultad_id: mockUserRow.faculty_id,
          escuela_id: mockUserRow.professional_school_id,
          ciclo: mockUserRow.current_academic_cycle,
        }),
        expect.anything()
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AuthRepository — direct unit tests for uncovered methods
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthRepository', () => {
  let repo: AuthRepository;

  beforeEach(() => {
    repo = new AuthRepository();
  });

  describe('findById()', () => {
    it('should return a User when the id exists in the database', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 });

      const result = await repo.findById(mockUserRow.id);

      expect(result).toEqual(mockUserRow);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return null when no user matches the given id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById('non-existent-uuid-0000');

      expect(result).toBeNull();
    });
  });

  describe('create() — optional field defaults', () => {
    it('should create a user with null professional_school_id and current_academic_cycle when omitted', async () => {
      const minimalInput = {
        full_name: 'Carlos Ramos',
        email: 'c.ramos@unsch.edu.pe',
        password_hash: '$2b$12$someHashValue',
        role: 'alumnus' as const,
        // professional_school_id and current_academic_cycle deliberately omitted
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{
          ...mockUserRow,
          email: 'c.ramos@unsch.edu.pe',
          professional_school_id: null,
          current_academic_cycle: null,
        }],
        rowCount: 1,
      });

      const result = await repo.create(minimalInput);

      // Verify the INSERT was called — the values array should contain nulls
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0][0];
      // The 5th value (index 4) is professional_school_id — must be null
      expect(callArgs.values[4]).toBeNull();
      // The 6th value (index 5) is current_academic_cycle — must be null
      expect(callArgs.values[5]).toBeNull();
      expect(result).toBeDefined();
    });
  });
});
