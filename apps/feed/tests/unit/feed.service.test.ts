/**
 * Tests de FeedService desde @social-unsch/feed-domain.
 * Verifica que la lógica de negocio compartida funciona correctamente.
 */
import { FeedService, IFeedRepository, IFeedPost, FeedError } from '@social-unsch/feed-domain';

const makePost = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
  id: 'post-feed-svc-001',
  user_id: 'user-001',
  faculty_id: null,
  professional_school_id: null,
  content: 'Contenido de prueba',
  is_visible: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  author_name: 'Test User',
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

describe('FeedService (from @social-unsch/feed-domain)', () => {
  describe('getFeed()', () => {
    it('should return posts from repository', async () => {
      const posts = [makePost(), makePost({ id: 'post-002' })];
      const repo = makeMockRepo({ findFiltered: jest.fn().mockResolvedValue(posts) });
      const service = new FeedService(repo);
      const result = await service.getFeed();
      expect(result).toHaveLength(2);
    });

    it('should clamp page to 1 when page <= 0', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.getFeed(undefined, undefined, 0, 20);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 0);
    });

    it('should clamp limit to 50 when limit > 50', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.getFeed(undefined, undefined, 1, 100);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 50, 0);
    });

    it('should compute offset correctly for page=2, limit=10', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.getFeed(undefined, undefined, 2, 10);
      expect(repo.findFiltered).toHaveBeenCalledWith(undefined, undefined, 10, 10);
    });
  });

  describe('createPost()', () => {
    const userId = 'user-create-001';

    it('should create post with valid content', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      const result = await service.createPost({ userId, content: 'Hola mundo' });
      expect(result.id).toBe('post-feed-svc-001');
    });

    it('should throw FeedError 400 for empty content', async () => {
      const service = new FeedService(makeMockRepo());
      await expect(service.createPost({ userId, content: '' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
      });
    });

    it('should throw FeedError 400 for content > 2000 chars', async () => {
      const service = new FeedService(makeMockRepo());
      await expect(service.createPost({ userId, content: 'A'.repeat(2001) })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
      });
    });

    it('should throw FeedError instance', async () => {
      const service = new FeedService(makeMockRepo());
      const err = await service.createPost({ userId, content: '' }).catch((e) => e);
      expect(err).toBeInstanceOf(FeedError);
    });

    it('should sanitize & character to &amp;', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.createPost({ userId, content: 'Tom & Jerry' });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'Tom &amp; Jerry' }));
    });

    it('should sanitize <script> tag', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.createPost({ userId, content: '<script>' });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('&lt;') }));
    });

    it('should trim whitespace before sanitization', async () => {
      const repo = makeMockRepo();
      const service = new FeedService(repo);
      await service.createPost({ userId, content: '   Trimmed   ' });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'Trimmed' }));
    });
  });
});
