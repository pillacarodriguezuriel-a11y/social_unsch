/**
 * Unit Test Suite: AuthValidators (Zod schemas)
 *
 * Covers every branch of registerSchema and loginSchema:
 *   - Valid inputs pass through
 *   - Invalid email domain (non-@unsch.edu.pe)
 *   - Password complexity requirements
 *   - Role enum validation
 *   - Required field enforcement
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import { registerSchema, loginSchema } from '../../src/modules/auth/auth.validators';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const validRegisterInput = {
  full_name: 'Uriel Pillacaro Rodriguez',
  email: 'u.pillacaro@unsch.edu.pe',
  password: 'SecurePass1!',
  role: 'student' as const,
  professional_school_id: 3,
  current_academic_cycle: 8,
};

const validLoginInput = {
  email: 'u.pillacaro@unsch.edu.pe',
  password: 'SecurePass1!',
};

// ─── registerSchema ───────────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('should accept a valid student registration payload', () => {
    const result = registerSchema.safeParse(validRegisterInput);
    expect(result.success).toBe(true);
  });

  it('should accept role "alumnus" as valid', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, role: 'alumnus' });
    expect(result.success).toBe(true);
  });

  it('should accept role "professor" as valid', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, role: 'professor' });
    expect(result.success).toBe(true);
  });

  it('should reject role "administrator" from public registration', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, role: 'administrator' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Los roles administrativos no pueden ser autoasignados');
    }
  });

  it('should reject unknown roles like "superadmin" or "guest"', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, role: 'guest' });
    expect(result.success).toBe(false);
  });

  it('should reject email not belonging to @unsch.edu.pe domain', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'user@gmail.com' });
    expect(result.success).toBe(false);
  });

  it('should reject email from a similar but wrong domain like @unsch.edu', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'user@unsch.edu' });
    expect(result.success).toBe(false);
  });

  it('should reject email from @hotmail.com domain', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'user@hotmail.com' });
    expect(result.success).toBe(false);
  });

  it('should reject an entirely invalid email format', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'notanemail' });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'Ab1!' });
    expect(result.success).toBe(false);
  });

  it('should reject password without uppercase letter', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'securepass1!' });
    expect(result.success).toBe(false);
  });

  it('should reject password without a digit', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'SecurePass!' });
    expect(result.success).toBe(false);
  });

  it('should reject password without a special character', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'SecurePass1' });
    expect(result.success).toBe(false);
  });

  it('should reject role "superadmin" as it is not in the allowed enum', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, role: 'superadmin' });
    expect(result.success).toBe(false);
  });

  it('should reject missing full_name', () => {
    const { full_name, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const { email, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const { password, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('should reject missing role', () => {
    const { role, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('should accept optional professional_school_id being absent', () => {
    const { professional_school_id, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('should accept optional current_academic_cycle being absent', () => {
    const { current_academic_cycle, ...body } = validRegisterInput;
    const result = registerSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('should reject an empty object', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('should accept a valid login payload', () => {
    const result = loginSchema.safeParse(validLoginInput);
    expect(result.success).toBe(true);
  });

  it('should reject email not from @unsch.edu.pe on login', () => {
    const result = loginSchema.safeParse({ ...validLoginInput, email: 'user@yahoo.com' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format on login', () => {
    const result = loginSchema.safeParse({ ...validLoginInput, email: 'bademail' });
    expect(result.success).toBe(false);
  });

  it('should reject missing email on login', () => {
    const result = loginSchema.safeParse({ password: 'SecurePass1!' });
    expect(result.success).toBe(false);
  });

  it('should reject missing password on login', () => {
    const result = loginSchema.safeParse({ email: 'u.pillacaro@unsch.edu.pe' });
    expect(result.success).toBe(false);
  });

  it('should reject an empty object on login', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should accept empty string as password (loginSchema has no min-length constraint)', () => {
    // loginSchema intentionally does not enforce password complexity — that is
    // handled by the bcrypt compare in the service layer. An empty string passes
    // Zod but will never match a real hash.
    const result = loginSchema.safeParse({ ...validLoginInput, password: '' });
    expect(result.success).toBe(true);
  });
});
