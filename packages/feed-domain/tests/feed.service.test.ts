/**
 * Unit Test Suite: FeedService
 *
 * Estrategia: se inyectan dobles de IFeedRepository. Las pruebas verifican
 * el comportamiento del servicio (validaciones, paginación, XSS) sin depender
 * de SQL ni del pool de PostgreSQL.
 */

import { FeedService } from '../src/feed.service';
import { FeedError } from '../src/errors';
import type { IFeedPost, IFeedRepository } from '../src/ports';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePost = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
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

function makeMockRepo(overrides: Partial<IFeedRepository> = {}): IFeedRepository {
  return {
    findFiltered: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(makePost()),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FeedService', () => {
  // ════════════════════════════════════════════════════════════════════
  // getFeed()
  // ════════════════════════════════════════════════════════════════════

  describe('getFeed()', () => {
    it('should return posts array from repository', async () => {
      const posts = [makePost(), makePost({ id: 'post-uuid-0002' })];
      const repo = makeMockRepo({ findFiltered: jest.fn().mockResolvedValue(posts) });
      const service = new FeedService(repo);

      const result = await service.getFeed();
      expect(result).toHaveLength(2);
    });

    it('should clamp page to 1 when page is 0', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 0, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 0);
    });

    it('should clamp page to 1 when page is negative', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, -5, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 0);
    });

    it('should compute offset = (page-1)*limit for page=2, limit=10', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 2, 10);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 10, 10);
    });

    it('should compute offset = 40 for page=3, limit=20', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 3, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 40);
    });

    it('should clamp limit to 50 when limit exceeds 50', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 1, 200);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 50, 0);
    });

    it('should clamp limit to 1 when limit is 0', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 1, 0);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 1, 0);
    });

    it('should clamp limit to 1 when limit is negative', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, undefined, 1, -100);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 1, 0);
    });

    it('should pass facultyId filter to repository when provided', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(2, undefined, 1, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(2, undefined, 20, 0);
    });

    it('should pass schoolId filter to repository when provided', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(undefined, 5, 1, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, 5, 20, 0);
    });

    it('should apply both faculty and school filters when both provided', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.getFeed(1, 3, 1, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(1, 3, 20, 0);
    });

    it('should return empty array when repository returns no posts', async () => {
      const repo = makeMockRepo({ findFiltered: jest.fn().mockResolvedValue([]) });
      const service = new FeedService(repo);

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
      const mockPost = makePost({ content: 'Proyecto de investigación' });
      const repo = makeMockRepo({ create: jest.fn().mockResolvedValue(mockPost) });
      const service = new FeedService(repo);

      const result = await service.createPost({ userId, content: 'Proyecto de investigación' });
      expect(result.id).toBe('post-uuid-0001');
    });

    it('should throw FeedError 400 ERR_VALIDATION_INVALID_FIELDS when content is empty string', async () => {
      const service = new FeedService(makeMockRepo());
      await expect(service.createPost({ userId, content: '' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
        message: 'El contenido de la publicación no puede estar vacío.',
      });
    });

    it('should throw FeedError 400 when content is only whitespace', async () => {
      const service = new FeedService(makeMockRepo());
      await expect(service.createPost({ userId, content: '   ' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
      });
    });

    it('should throw FeedError 400 when content exceeds 2000 characters', async () => {
      const service = new FeedService(makeMockRepo());
      await expect(service.createPost({ userId, content: 'A'.repeat(2001) })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
        message: 'El contenido de la publicación no debe superar los 2000 caracteres.',
      });
    });

    it('should accept content of exactly 2000 characters', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await expect(service.createPost({ userId, content: 'A'.repeat(2000) })).resolves.toBeDefined();
    });

    it('should sanitize & character to &amp; before calling repository', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'Tom & Jerry' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Tom &amp; Jerry' })
      );
    });

    it('should sanitize < character to &lt;', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: '<script>' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('&lt;') })
      );
    });

    it('should sanitize > character to &gt;', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: '1 > 0' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('&gt;') })
      );
    });

    it('should sanitize " character to &quot;', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'He said "hello"' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('&quot;') })
      );
    });

    it("should sanitize ' character to &#x27;", async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: "It's fine" });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('&#x27;') })
      );
    });

    it('should sanitize / character to &#x2F;', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'path/to/file' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('&#x2F;') })
      );
    });

    it('should trim whitespace from content before XSS sanitization', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: '   Trimmed   ' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Trimmed' })
      );
    });

    it('should pass facultyId to repository when provided', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'Hello', facultyId: 2 });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ facultyId: 2 })
      );
    });

    it('should pass schoolId to repository when provided', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'Hello', schoolId: 7 });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 7 })
      );
    });

    it('should default facultyId and schoolId to undefined when omitted', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);

      await service.createPost({ userId, content: 'Hello' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId, content: 'Hello' })
      );
    });

    it('should throw FeedError instance when content validation fails', async () => {
      const service = new FeedService(makeMockRepo());
      const err = await service.createPost({ userId, content: '' }).catch((e) => e);
      expect(err).toBeInstanceOf(FeedError);
    });
  });
});
