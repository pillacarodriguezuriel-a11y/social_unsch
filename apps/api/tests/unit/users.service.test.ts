/**
 * Unit Test Suite: UsersService
 *
 * Mocks: pg pool, UsersRepository
 * Covers: acceptTerms() — success path and user-not-found error path
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { UsersService } from '../../src/modules/users/users.service';
import { AppError } from '../../src/shared/errors/AppError';

const mockQuery = pool.query as jest.Mock;

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  // ══════════════════════════════════════════════════════════════════
  // acceptTerms()
  // ══════════════════════════════════════════════════════════════════

  describe('acceptTerms()', () => {
    const userId = 'a1b2c3d4-1111-4abc-8def-000000000001';

    it('should resolve without error when the user exists and terms are updated', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 });
      await expect(service.acceptTerms(userId)).resolves.toBeUndefined();
    });

    it('should call pool.query exactly once', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 });
      await service.acceptTerms(userId);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw AppError 404 ERR_USER_NOT_FOUND when rowCount is 0 (user not found)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(service.acceptTerms('non-existent-uuid')).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_USER_NOT_FOUND',
        message: 'El usuario especificado no existe o no se pudo actualizar.',
      });
    });

    it('should throw AppError 404 when rowCount is null (defensive check)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: null });
      await expect(service.acceptTerms(userId)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_USER_NOT_FOUND',
      });
    });

    it('should throw an instance of AppError (not a plain Error)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const err = await service.acceptTerms(userId).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should propagate unexpected database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));
      await expect(service.acceptTerms(userId)).rejects.toThrow('DB connection lost');
    });

    it('should pass the correct userId to the repository query', async () => {
      const targetId = 'target-user-uuid-9999';
      mockQuery.mockResolvedValueOnce({ rows: [{ id: targetId }], rowCount: 1 });
      await service.acceptTerms(targetId);
      const queryArg = mockQuery.mock.calls[0][0];
      expect(queryArg.values[0]).toBe(targetId);
    });
  });
});
