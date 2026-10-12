/**
 * Unit Test Suite: UsersRepository
 *
 * Mocks: pg pool (direct pool.query mock)
 * Covers: acceptTerms() — returning true when rowCount > 0, false when rowCount is 0
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { UsersRepository } from '../../src/modules/users/users.repository';

const mockQuery = pool.query as jest.Mock;

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(() => {
    repo = new UsersRepository();
  });

  // ══════════════════════════════════════════════════════════════════
  // acceptTerms()
  // ══════════════════════════════════════════════════════════════════

  describe('acceptTerms()', () => {
    const userId = 'b2c3d4e5-2222-4bcd-9ef0-000000000002';

    it('should return true when the UPDATE affects 1 row (rowCount = 1)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 });
      const result = await repo.acceptTerms(userId);
      expect(result).toBe(true);
    });

    it('should return false when the UPDATE affects 0 rows (user not found)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await repo.acceptTerms('ghost-uuid');
      expect(result).toBe(false);
    });

    it('should return false when rowCount is null (pg edge case)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: null });
      const result = await repo.acceptTerms(userId);
      expect(result).toBe(false);
    });

    it('should call pool.query exactly once', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }], rowCount: 1 });
      await repo.acceptTerms(userId);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should include userId in the query values at index 0', async () => {
      const specificId = 'specific-user-id-0001';
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await repo.acceptTerms(specificId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe(specificId);
    });

    it('should use a named query (for pg prepared statement caching)', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await repo.acceptTerms(userId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.name).toBeDefined();
      expect(typeof callArg.name).toBe('string');
    });

    it('should execute an UPDATE statement that sets has_accepted_terms = true', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await repo.acceptTerms(userId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('has_accepted_terms = true');
    });

    it('should propagate database errors to the caller', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(repo.acceptTerms(userId)).rejects.toThrow('Connection refused');
    });
  });
});
