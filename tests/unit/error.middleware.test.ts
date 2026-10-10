/**
 * Unit Test Suite: errorMiddleware
 *
 * Strategy: Direct function call with mocked req/res/next.
 * Covers:
 *   - AppError handling → correct statusCode, message, and code
 *   - ZodError handling → 400 with ERR_VALIDATION_INVALID_FIELDS
 *   - Unknown error → 500 ERR_SERVER_INTERNAL_ERROR
 *   - next is NOT called for AppError and ZodError (middleware terminates)
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorMiddleware } from '../../src/middlewares/error.middleware';
import { AppError } from '../../src/shared/errors/AppError';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const makeMockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockReq = {} as Request;
const mockNext: NextFunction = jest.fn();

// ─── Helper to generate a ZodError ───────────────────────────────────────────

const makeZodError = (schemaOverride?: z.ZodSchema): ZodError => {
  const schema = schemaOverride ?? z.object({ name: z.string() });
  try {
    schema.parse({});
  } catch (e) {
    if (e instanceof ZodError) return e;
  }
  throw new Error('Failed to create ZodError');
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('errorMiddleware', () => {

  // ════════════════════════════════════════════════════════════════════
  // AppError handling
  // ════════════════════════════════════════════════════════════════════

  describe('AppError handling', () => {
    it('should respond with AppError statusCode and message', () => {
      const res = makeMockRes();
      const err = new AppError('Test error', 422, 'ERR_TEST');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: true,
        message: 'Test error',
        code: 'ERR_TEST',
      }));
    });

    it('should respond with 400 for a 400 AppError', () => {
      const res = makeMockRes();
      const err = new AppError('Bad request', 400, 'ERR_BAD_REQUEST');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should respond with 401 for a 401 AppError', () => {
      const res = makeMockRes();
      const err = new AppError('Unauthorized', 401, 'ERR_UNAUTHORIZED');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should respond with 403 for a 403 AppError', () => {
      const res = makeMockRes();
      const err = new AppError('Forbidden', 403, 'ERR_FORBIDDEN');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should respond with 404 for a 404 AppError', () => {
      const res = makeMockRes();
      const err = new AppError('Not found', 404, 'ERR_NOT_FOUND');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should set error: true in the JSON body', () => {
      const res = makeMockRes();
      const err = new AppError('Something failed', 500, 'ERR_SOMETHING');
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.error).toBe(true);
    });

    it('should include the errorCode in the response body', () => {
      const res = makeMockRes();
      const err = new AppError('Not found', 404, 'ERR_USER_NOT_FOUND');
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.code).toBe('ERR_USER_NOT_FOUND');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // ZodError handling
  // ════════════════════════════════════════════════════════════════════

  describe('ZodError handling', () => {
    it('should respond with 400 for a ZodError', () => {
      const res = makeMockRes();
      const err = makeZodError();
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should set code ERR_VALIDATION_INVALID_FIELDS for ZodError', () => {
      const res = makeMockRes();
      const err = makeZodError();
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('should set error: true for ZodError', () => {
      const res = makeMockRes();
      const err = makeZodError();
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.error).toBe(true);
    });

    it('should include the field path in the error message for ZodError', () => {
      const res = makeMockRes();
      const schema = z.object({ email: z.string().email() });
      const err = makeZodError(schema);
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.message).toContain('email');
    });

    it('should use fallback message when ZodError has no issues', () => {
      const res = makeMockRes();
      const emptyZodErr = new ZodError([]);
      errorMiddleware(emptyZodErr, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.message).toBe('Error de validación en los datos provistos.');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Unknown error — 500 catch-all
  // ════════════════════════════════════════════════════════════════════

  describe('Unknown error (500 catch-all)', () => {
    it('should respond with 500 for a plain Error', () => {
      const res = makeMockRes();
      const err = new Error('Something broke');
      errorMiddleware(err, mockReq, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should set code ERR_SERVER_INTERNAL_ERROR for plain errors', () => {
      const res = makeMockRes();
      const err = new Error('DB crash');
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.code).toBe('ERR_SERVER_INTERNAL_ERROR');
    });

    it('should include the generic internal server message in the body', () => {
      const res = makeMockRes();
      const err = new Error('Unknown failure');
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.message).toBe('Ha ocurrido un error interno en el servidor. Inténtelo más tarde.');
    });

    it('should set error: true for plain unknown errors', () => {
      const res = makeMockRes();
      const err = new Error('crash');
      errorMiddleware(err, mockReq, res, mockNext);
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.error).toBe(true);
    });
  });
});
