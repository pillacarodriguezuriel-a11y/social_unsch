/**
 * Unit Test Suite: FeedService
 *
 * Mocks: pg pool, FeedRepository
 * Covers:
 *   - sanitizeXSS()  — all HTML special characters
 *   - getFeed()      — page/limit clamping, offset calculation, filter delegation
 *   - createPost()   — empty content, content > 2000 chars, XSS sanitization, happy path
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { FeedService } from '../../src/modules/feed/feed.service';
import { FeedPost } from '../../src/modules/feed/feed.repository';
import { AppError } from '../../src/shared/errors/AppError';

const mockQuery = pool.query as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeMockPost = (overrides: Partial<FeedPost> = {}): FeedPost => ({
  id: 'post-uuid-0001',
  user_id: 'user-uuid-0001',
  faculty_id: 1,
  professional_school_id: 3,
  content: 'Contenido de prueba académica',
  is_visible: true,
  created_at: new Date('2025-06-01T10:00:00Z'),
  author_name: 'Maria Torres',
  author_role: 'student',
  ...overrides,
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(() => {
    service = new FeedService();
  });

  // ════════════════════════════════════════════════════════════════════
  // getFeed()
  // ════════════════════════════════════════════════════════════════════

  describe('getFeed()', () => {
    it('should return posts array from repository on a basic call', async () => {
      const posts = [makeMockPost(), makeMockPost({ id: 'post-uuid-0002' })];
      mockQuery.mockResolvedValueOnce({ rows: posts, rowCount: 2 });
      const result = await service.getFeed();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should clamp page to 1 when page is 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 0, 20);
      // offset = (max(1,0) - 1) * 20 = 0
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(0); // offset should be 0
    });

    it('should clamp page to 1 when page is negative', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, -5, 20);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(0); // offset = 0
    });

    it('should use offset = (page-1) * limit for page=2, limit=10', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 2, 10);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(10); // offset = (2-1)*10 = 10
    });

    it('should use offset = 40 for page=3, limit=20', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 3, 20);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(40); // offset = (3-1)*20 = 40
    });

    it('should clamp limit to 50 when limit exceeds 50', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 1, 200);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(50); // limit capped at 50
    });

    it('should clamp limit to 1 when limit is 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 1, 0);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(1); // limit min is 1
    });

    it('should clamp limit to 1 when limit is negative', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, undefined, 1, -100);
      const queryValues = mockQuery.mock.calls[0][0].values;
      expect(queryValues).toContain(1);
    });

    it('should pass facultyId filter to query when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(2, undefined, 1, 20);
      const queryText = mockQuery.mock.calls[0][0].text;
      expect(queryText).toContain('faculty_id');
    });

    it('should pass schoolId filter to query when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(undefined, 5, 1, 20);
      const queryText = mockQuery.mock.calls[0][0].text;
      expect(queryText).toContain('professional_school_id');
    });

    it('should apply both faculty and school filters when both provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await service.getFeed(1, 3, 1, 20);
      const queryText = mockQuery.mock.calls[0][0].text;
      expect(queryText).toContain('faculty_id');
      expect(queryText).toContain('professional_school_id');
    });

    it('should return empty array when repository returns no posts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await service.getFeed();
      expect(result).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // createPost()
  // ════════════════════════════════════════════════════════════════════

  describe('createPost()', () => {
    const userId = 'user-uuid-create-0001';

    it('should create a post successfully with valid content', async () => {
      const mockPost = makeMockPost({ content: 'Proyecto de investigación' });
      // First query: INSERT, second: author fetch
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Maria Torres', role: 'student' }] });
      const result = await service.createPost({ userId, content: 'Proyecto de investigación' });
      expect(result).toMatchObject({ id: 'post-uuid-0001' });
    });

    it('should throw AppError 400 ERR_VALIDATION_INVALID_FIELDS when content is empty string', async () => {
      await expect(service.createPost({ userId, content: '' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
        message: 'El contenido de la publicación no puede estar vacío.',
      });
    });

    it('should throw AppError 400 when content is only whitespace', async () => {
      await expect(service.createPost({ userId, content: '   ' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
      });
    });

    it('should throw AppError 400 when content exceeds 2000 characters', async () => {
      const longContent = 'A'.repeat(2001);
      await expect(service.createPost({ userId, content: longContent })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
        message: 'El contenido de la publicación no debe superar los 2000 caracteres.',
      });
    });

    it('should accept content of exactly 2000 characters', async () => {
      const exactContent = 'A'.repeat(2000);
      const mockPost = makeMockPost({ content: exactContent });
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Maria Torres', role: 'student' }] });
      await expect(service.createPost({ userId, content: exactContent })).resolves.toBeDefined();
    });

    it('should sanitize & character to &amp; before persisting', async () => {
      const mockPost = makeMockPost({ content: 'Tom &amp; Jerry' });
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'Tom & Jerry' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toBe('Tom &amp; Jerry');
    });

    it('should sanitize < character to &lt;', async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: '<script>' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toContain('&lt;');
    });

    it('should sanitize > character to &gt;', async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: '1 > 0' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toContain('&gt;');
    });

    it('should sanitize " character to &quot;', async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'He said "hello"' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toContain('&quot;');
    });

    it("should sanitize ' character to &#x27;", async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: "It's fine" });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toContain('&#x27;');
    });

    it('should sanitize / character to &#x2F;', async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'path/to/file' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toContain('&#x2F;');
    });

    it('should trim whitespace from content before XSS sanitization', async () => {
      const mockPost = makeMockPost({ content: 'Trimmed' });
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: '   Trimmed   ' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[3]).toBe('Trimmed');
    });

    it('should pass facultyId to repository when provided', async () => {
      const mockPost = makeMockPost({ faculty_id: 2 });
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'Hello', facultyId: 2 });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[1]).toBe(2);
    });

    it('should pass schoolId to repository when provided', async () => {
      const mockPost = makeMockPost({ professional_school_id: 7 });
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'Hello', schoolId: 7 });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[2]).toBe(7);
    });

    it('should default facultyId and schoolId to null when omitted', async () => {
      const mockPost = makeMockPost();
      mockQuery.mockResolvedValueOnce({ rows: [mockPost] });
      mockQuery.mockResolvedValueOnce({ rows: [{ full_name: 'Author', role: 'student' }] });
      await service.createPost({ userId, content: 'Hello' });
      const insertValues = mockQuery.mock.calls[0][0].values;
      expect(insertValues[1]).toBeNull();
      expect(insertValues[2]).toBeNull();
    });

    it('should throw AppError instance when content validation fails', async () => {
      const err = await service.createPost({ userId, content: '' }).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
    });
  });
});
