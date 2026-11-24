/**
 * Unit Test Suite: FeedRepository
 *
 * Se inyectan mocks del pool y del lector de metadatos de autor.
 * Covers:
 *   - findFiltered() — no filters, facultyId, schoolId, both, pagination offset
 *   - create()       — INSERT + author meta via IAuthorMetaReader, returned IFeedPost shape
 */

import { FeedRepository } from '../../src/modules/feed/feed.repository';
import { IAuthorMetaReader, IFeedPost } from '../../src/modules/feed/ports';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMockPool() {
  return { query: jest.fn() } as any;
}

function makeMockAuthorReader(meta = { full_name: 'Carlos Ramos', role: 'student' }): IAuthorMetaReader {
  return { getAuthorMeta: jest.fn().mockResolvedValue(meta) };
}

const makeRow = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
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

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FeedRepository', () => {
  // ════════════════════════════════════════════════════════════════════
  // findFiltered()
  // ════════════════════════════════════════════════════════════════════

  describe('findFiltered()', () => {
    it('should return an array of posts with default parameters', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [makeRow(), makeRow({ id: 'post-uuid-rep-002' })] });
      const repo = new FeedRepository(pool);

      const result = await repo.findFiltered();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no posts exist', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      const result = await repo.findFiltered();
      expect(result).toEqual([]);
    });

    it('should NOT include faculty_id filter when facultyId is undefined', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(undefined, undefined, 20, 0);
      const query = pool.query.mock.calls[0][0];
      expect(query.text).not.toMatch(/AND f\.faculty_id/);
    });

    it('should include faculty_id filter when facultyId is provided', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(2, undefined, 20, 0);
      const query = pool.query.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.faculty_id/);
      expect(query.values).toContain(2);
    });

    it('should NOT include school_id filter when schoolId is undefined', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(undefined, undefined, 20, 0);
      const query = pool.query.mock.calls[0][0];
      expect(query.text).not.toMatch(/AND f\.professional_school_id/);
    });

    it('should include school_id filter when schoolId is provided', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(undefined, 5, 20, 0);
      const query = pool.query.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.professional_school_id/);
      expect(query.values).toContain(5);
    });

    it('should include both filters when both facultyId and schoolId are provided', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(1, 3, 20, 0);
      const query = pool.query.mock.calls[0][0];
      expect(query.text).toMatch(/AND f\.faculty_id/);
      expect(query.text).toMatch(/AND f\.professional_school_id/);
      expect(query.values).toContain(1);
      expect(query.values).toContain(3);
    });

    it('should pass limit=10 and offset=20 to query values', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered(undefined, undefined, 10, 20);
      const query = pool.query.mock.calls[0][0];
      expect(query.values).toContain(10);
      expect(query.values).toContain(20);
    });

    it('should ORDER BY created_at DESC in the query', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered();
      const query = pool.query.mock.calls[0][0];
      expect(query.text).toMatch(/ORDER BY f\.created_at DESC/);
    });

    it('should filter only visible posts (is_visible = true)', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);

      await repo.findFiltered();
      const query = pool.query.mock.calls[0][0];
      expect(query.text).toMatch(/is_visible = true/);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // create()
  // ════════════════════════════════════════════════════════════════════

  describe('create()', () => {
    const userId = 'user-uuid-author-001';

    it('should return a complete IFeedPost including author_name and author_role', async () => {
      const pool = makeMockPool();
      const authorReader = makeMockAuthorReader({ full_name: 'Uriel Pillacaro', role: 'student' });
      const postRow = {
        id: 'post-new-001',
        user_id: userId,
        faculty_id: 1,
        professional_school_id: 3,
        content: 'Nuevo post de investigación',
        is_visible: true,
        created_at: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [postRow] });
      const repo = new FeedRepository(pool, authorReader);

      const result = await repo.create({
        userId,
        content: 'Nuevo post de investigación',
        facultyId: 1,
        schoolId: 3,
      });

      expect(result.id).toBe('post-new-001');
      expect(result.author_name).toBe('Uriel Pillacaro');
      expect(result.author_role).toBe('student');
      expect(authorReader.getAuthorMeta).toHaveBeenCalledWith(userId);
    });

    it('should call pool.query once (INSERT) and authorMetaReader.getAuthorMeta once', async () => {
      const pool = makeMockPool();
      const authorReader = makeMockAuthorReader();
      const postRow = { id: 'post-new-002', user_id: userId, content: 'Test', is_visible: true, created_at: new Date() };
      pool.query.mockResolvedValueOnce({ rows: [postRow] });
      const repo = new FeedRepository(pool, authorReader);

      await repo.create({ userId, content: 'Test' });
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(authorReader.getAuthorMeta).toHaveBeenCalledTimes(1);
    });

    it('should default facultyId and schoolId to null when not provided', async () => {
      const pool = makeMockPool();
      const postRow = { id: 'post-null', user_id: userId, content: 'Hello', is_visible: true, created_at: new Date() };
      pool.query.mockResolvedValueOnce({ rows: [postRow] });
      const repo = new FeedRepository(pool, makeMockAuthorReader());

      await repo.create({ userId, content: 'Hello' });

      const insertQuery = pool.query.mock.calls[0][0];
      expect(insertQuery.values[1]).toBeNull(); // facultyId
      expect(insertQuery.values[2]).toBeNull(); // schoolId
    });

    it('should pass userId as the first INSERT value', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'p', user_id: userId, content: 'c', is_visible: true, created_at: new Date() }] });
      const repo = new FeedRepository(pool, makeMockAuthorReader());

      await repo.create({ userId, content: 'c' });
      const values = pool.query.mock.calls[0][0].values;
      expect(values[0]).toBe(userId);
    });

    it('should pass content as the 4th INSERT value', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'p2', user_id: userId, content: 'safe', is_visible: true, created_at: new Date() }] });
      const repo = new FeedRepository(pool, makeMockAuthorReader());

      await repo.create({ userId, content: 'safe content' });
      const values = pool.query.mock.calls[0][0].values;
      expect(values[3]).toBe('safe content');
    });

    it('should execute an INSERT INTO feed_posts statement', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'p3', user_id: userId, content: 'c', is_visible: true, created_at: new Date() }] });
      const repo = new FeedRepository(pool, makeMockAuthorReader());

      await repo.create({ userId, content: 'c' });
      const insertText = pool.query.mock.calls[0][0].text;
      expect(insertText).toMatch(/INSERT INTO feed_posts/);
    });

    it('should spread all postRow fields into the returned IFeedPost', async () => {
      const pool = makeMockPool();
      const postRow = {
        id: 'spread-post-01',
        user_id: userId,
        faculty_id: 2,
        professional_school_id: 4,
        content: 'Spread test',
        is_visible: true,
        created_at: new Date('2025-08-01T00:00:00Z'),
      };
      pool.query.mockResolvedValueOnce({ rows: [postRow] });
      const repo = new FeedRepository(pool, makeMockAuthorReader({ full_name: 'Ana Quispe', role: 'teacher' }));

      const result = await repo.create({ userId, content: 'Spread test', facultyId: 2, schoolId: 4 });
      expect(result.faculty_id).toBe(2);
      expect(result.professional_school_id).toBe(4);
      expect(result.is_visible).toBe(true);
      expect(result.author_name).toBe('Ana Quispe');
      expect(result.author_role).toBe('teacher');
    });

    it('should return empty strings for author fields when author is not found', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'p', user_id: userId, content: 'c', is_visible: true, created_at: new Date() }] });
      const noAuthor: IAuthorMetaReader = { getAuthorMeta: jest.fn().mockResolvedValue(null) };
      const repo = new FeedRepository(pool, noAuthor);

      const result = await repo.create({ userId, content: 'c' });
      expect(result.author_name).toBe('');
      expect(result.author_role).toBe('');
    });
  });
});
