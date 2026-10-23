/**
 * Unit Test Suite: FeedRepository
 *
 * Mocks: pg pool
 * Covers:
 *   - findFiltered() — no filters, facultyId, schoolId, both, pagination offset
 *   - create()       — INSERT + author meta fetch, returned FeedPost shape
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { FeedRepository, FeedPost } from '../../src/modules/feed/feed.repository';

const mockQuery = pool.query as jest.Mock;

const makeMockRow = (overrides: Partial<FeedPost> = {}): FeedPost => ({
  id: 'post-uuid-rep-001',
  user_id: 'user-uuid-rep-001',
  faculty_id: 1,
  professional_school_id: 3,
  content: 'Contenido de prueba',
  is_visible: true,
  created_at: new Date('2025-07-01T00:00:00Z'),
  author_name: 'Carlos Ramos',
  author_role: 'student',
  ...overrides,
});

describe('FeedRepository', () => {
  let repo: FeedRepository;

  beforeEach(() => {
    repo = new FeedRepository();
  });

  // ════════════════════════════════════════════════════════════════════
  // findFiltered()
  // ════════════════════════════════════════════════════════════════════

  describe('findFiltered()', () => {
    it('should return an array of posts with default parameters', async () => {
      const posts = [makeMockRow(), makeMockRow({ id: 'post-uuid-rep-002' })];
      mockQuery.mockResolvedValueOnce({ rows: posts });
      const result = await repo.findFiltered();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no posts exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await repo.findFiltered();
      expect(result).toEqual([]);
    });

    it('should NOT include faculty_id filter in query when facultyId is undefined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(undefined, undefined, 20, 0);
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).not.toMatch(/AND f\.faculty_id/);
    });

    it('should include faculty_id filter in query when facultyId is provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(2, undefined, 20, 0);
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.faculty_id/);
      expect(query.values).toContain(2);
    });

    it('should NOT include school_id filter when schoolId is undefined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(undefined, undefined, 20, 0);
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).not.toMatch(/AND f\.professional_school_id/);
    });

    it('should include school_id filter when schoolId is provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(undefined, 5, 20, 0);
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.professional_school_id/);
      expect(query.values).toContain(5);
    });

    it('should include both filters when both facultyId and schoolId are provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(1, 3, 20, 0);
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.faculty_id/);
      expect(query.text).toMatch(/AND f\.professional_school_id/);
      expect(query.values).toContain(1);
      expect(query.values).toContain(3);
    });

    it('should pass limit=10 and offset=20 to query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered(undefined, undefined, 10, 20);
      const query = mockQuery.mock.calls[0][0];
      expect(query.values).toContain(10);
      expect(query.values).toContain(20);
    });

    it('should ORDER BY created_at DESC in the query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered();
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).toMatch(/ORDER BY f\.created_at DESC/);
    });

    it('should filter only visible posts (is_visible = true)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findFiltered();
      const query = mockQuery.mock.calls[0][0];
      expect(query.text).toMatch(/is_visible = true/);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // create()
  // ════════════════════════════════════════════════════════════════════

  describe('create()', () => {
    const userId = 'user-uuid-author-001';

    it('should return a complete FeedPost including author_name and author_role', async () => {
      const postRow = {
        id: 'post-new-001',
        user_id: userId,
        faculty_id: 1,
        professional_school_id: 3,
        content: 'Nuevo post de investigación',
        is_visible: true,
        created_at: new Date(),
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ full_name: 'Uriel Pillacaro', role: 'student' }] }); // author fetch

      const result = await repo.create({
        userId,
        content: 'Nuevo post de investigación',
        facultyId: 1,
        schoolId: 3,
      });

      expect(result.id).toBe('post-new-001');
      expect(result.author_name).toBe('Uriel Pillacaro');
      expect(result.author_role).toBe('student');
    });

    it('should call pool.query twice (INSERT then author SELECT)', async () => {
      const postRow = { id: 'post-new-002', user_id: userId, content: 'Test', is_visible: true, created_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });

      await repo.create({ userId, content: 'Test' });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should default facultyId and schoolId to null when not provided', async () => {
      const postRow = { id: 'post-null', user_id: userId, content: 'Hello', is_visible: true, created_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });

      await repo.create({ userId, content: 'Hello' });

      const insertQuery = mockQuery.mock.calls[0][0];
      const values = insertQuery.values;
      expect(values[1]).toBeNull(); // facultyId
      expect(values[2]).toBeNull(); // schoolId
    });

    it('should pass userId as the first INSERT value', async () => {
      const postRow = { id: 'p', user_id: userId, content: 'c', is_visible: true, created_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'A', role: 'student' }] });

      await repo.create({ userId, content: 'c' });
      const values = mockQuery.mock.calls[0][0].values;
      expect(values[0]).toBe(userId);
    });

    it('should pass sanitized content as the 4th INSERT value', async () => {
      const postRow = { id: 'p2', user_id: userId, content: 'safe', is_visible: true, created_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'A', role: 'student' }] });

      await repo.create({ userId, content: 'safe content' });
      const values = mockQuery.mock.calls[0][0].values;
      expect(values[3]).toBe('safe content');
    });

    it('should execute an INSERT INTO feed_posts statement', async () => {
      const postRow = { id: 'p3', user_id: userId, content: 'c', is_visible: true, created_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'A', role: 'student' }] });

      await repo.create({ userId, content: 'c' });
      const insertText = mockQuery.mock.calls[0][0].text;
      expect(insertText).toMatch(/INSERT INTO feed_posts/);
    });

    it('should spread all postRow fields into the returned FeedPost', async () => {
      const postRow = {
        id: 'spread-post-01',
        user_id: userId,
        faculty_id: 2,
        professional_school_id: 4,
        content: 'Spread test',
        is_visible: true,
        created_at: new Date('2025-08-01T00:00:00Z'),
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [postRow] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Ana Quispe', role: 'teacher' }] });

      const result = await repo.create({ userId, content: 'Spread test', facultyId: 2, schoolId: 4 });
      expect(result.faculty_id).toBe(2);
      expect(result.professional_school_id).toBe(4);
      expect(result.is_visible).toBe(true);
    });
  });
});
