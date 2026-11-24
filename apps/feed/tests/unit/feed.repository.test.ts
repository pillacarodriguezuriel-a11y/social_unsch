/**
 * Tests del FeedRepository de apps/feed.
 * Inyecta pool e IAuthorMetaReader como mocks.
 */
import { FeedRepository } from '../../src/modules/feed/feed.repository';
import type { IAuthorMetaReader, IFeedPost } from '@social-unsch/feed-domain';

function makeMockPool() {
  return { query: jest.fn() } as any;
}

function makeMockAuthorReader(meta = { full_name: 'Ana Quispe', role: 'student' }): IAuthorMetaReader {
  return { getAuthorMeta: jest.fn().mockResolvedValue(meta) };
}

const makeRow = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
  id: 'post-rep-001',
  user_id: 'user-rep-001',
  faculty_id: 1,
  professional_school_id: null,
  content: 'Contenido de prueba',
  is_visible: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  author_name: 'Ana Quispe',
  author_role: 'student',
  ...overrides,
});

describe('FeedRepository (apps/feed)', () => {
  describe('findFiltered()', () => {
    it('should return rows from pool', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [makeRow(), makeRow({ id: 'post-rep-002' })] });
      const repo = new FeedRepository(pool);
      const result = await repo.findFiltered();
      expect(result).toHaveLength(2);
    });

    it('should include faculty_id filter when provided', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);
      await repo.findFiltered(2);
      expect(pool.query.mock.calls[0][0].text).toMatch(/AND f\.faculty_id/);
    });

    it('should filter only visible posts', async () => {
      const pool = makeMockPool();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const repo = new FeedRepository(pool);
      await repo.findFiltered();
      expect(pool.query.mock.calls[0][0].text).toMatch(/is_visible = true/);
    });
  });

  describe('create()', () => {
    const userId = 'user-create-rep-001';

    it('should return post with author metadata from IAuthorMetaReader', async () => {
      const pool = makeMockPool();
      const authorReader = makeMockAuthorReader({ full_name: 'Carlos Ramos', role: 'professor' });
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'new-post', user_id: userId, content: 'Test', is_visible: true, created_at: new Date() }] });
      const repo = new FeedRepository(pool, authorReader);
      const result = await repo.create({ userId, content: 'Test' });
      expect(result.author_name).toBe('Carlos Ramos');
      expect(result.author_role).toBe('professor');
    });

    it('should call pool.query once and authorReader once', async () => {
      const pool = makeMockPool();
      const authorReader = makeMockAuthorReader();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'p', user_id: userId, content: 'c', is_visible: true, created_at: new Date() }] });
      const repo = new FeedRepository(pool, authorReader);
      await repo.create({ userId, content: 'c' });
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(authorReader.getAuthorMeta).toHaveBeenCalledTimes(1);
    });

    it('should use empty strings when author not found', async () => {
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
