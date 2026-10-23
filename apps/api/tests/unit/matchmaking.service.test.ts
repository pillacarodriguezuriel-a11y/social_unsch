/**
 * Unit Test Suite: MatchmakingService
 *
 * Mocks: pg pool (via MatchmakingRepository)
 * Covers:
 *   - calculateScore(): proyecto inexistente, proyecto cerrado, levels Alta/Media/Baja,
 *     matched/missing skills, cálculo con skills_offered cuando skills_needed está vacío,
 *     normalización case-insensitive, habilidades vacías de usuario
 *   - getDiscoverableProfiles(): happy path
 *   - submitInteraction(): pending like, accepted match, dislike, perfil no existe, autolike
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../../src/config/database';
import { MatchmakingService } from '../../src/modules/matchmaking/matchmaking.service';
import { MatchmakingProject, MatchmakingProfile } from '../../src/modules/matchmaking/matchmaking.repository';
import { AppError } from '../../src/shared/errors/AppError';

const mockQuery = pool.query as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<MatchmakingProject> = {}): MatchmakingProject => ({
  id: 'project-uuid-0001',
  owner_id: 'owner-uuid-0001',
  faculty_id: 1,
  title: 'Proyecto de Investigación UNSCH',
  description: 'Buscamos colaboradores para análisis de datos.',
  project_type: 'investigacion',
  skills_offered: ['Python', 'Data Analysis'],
  skills_needed: ['Machine Learning', 'TensorFlow'],
  max_members: 5,
  current_members: 2,
  is_open: true,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-06-01'),
  ...overrides,
});

const makeProfile = (overrides: Partial<MatchmakingProfile> = {}): MatchmakingProfile => ({
  id: 'profile-uuid-0001',
  user_id: 'user-uuid-0001',
  project_type: 'investigacion',
  description: 'Estudiante de sistemas',
  is_visible: true,
  created_at: new Date('2025-03-01'),
  full_name: 'Ana Quispe',
  role: 'student',
  ...overrides,
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  beforeEach(() => {
    service = new MatchmakingService();
  });

  // ════════════════════════════════════════════════════════════════════
  // calculateScore()
  // ════════════════════════════════════════════════════════════════════

  describe('calculateScore()', () => {
    const projectId = 'project-uuid-0001';

    it('should throw AppError 404 ERR_FEED_POST_NOT_FOUND when project does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(service.calculateScore(projectId, ['Python'])).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_FEED_POST_NOT_FOUND',
      });
    });

    it('should throw AppError 404 when project is closed (is_open = false)', async () => {
      const closedProject = makeProject({ is_open: false });
      mockQuery.mockResolvedValueOnce({ rows: [closedProject], rowCount: 1 });
      await expect(service.calculateScore(projectId, ['Python'])).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_FEED_POST_NOT_FOUND',
      });
    });

    it('should return affinity_level "Alta" when score >= 75', async () => {
      const project = makeProject({ skills_needed: ['Python', 'SQL', 'ML', 'Docker'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python', 'SQL', 'ML', 'Docker']);
      expect(result.affinity_level).toBe('Alta');
      expect(result.affinity_score).toBe(100);
    });

    it('should return affinity_level "Media" when score is between 40 and 74.99', async () => {
      const project = makeProject({ skills_needed: ['Python', 'SQL', 'ML'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python', 'SQL']);
      // 2/3 = 66.67% → Media
      expect(result.affinity_level).toBe('Media');
      expect(result.affinity_score).toBeCloseTo(66.67, 1);
    });

    it('should return affinity_level "Baja" when score is below 40', async () => {
      const project = makeProject({ skills_needed: ['Python', 'SQL', 'ML', 'Docker', 'Kubernetes'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python']);
      // 1/5 = 20% → Baja
      expect(result.affinity_level).toBe('Baja');
      expect(result.affinity_score).toBe(20);
    });

    it('should return score 0 when user has no matching skills', async () => {
      const project = makeProject({ skills_needed: ['Python', 'SQL'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Java', 'C++']);
      expect(result.affinity_score).toBe(0);
      expect(result.affinity_level).toBe('Baja');
    });

    it('should correctly identify matched_skills preserving original casing', async () => {
      const project = makeProject({ skills_needed: ['python', 'sql'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python', 'SQL']);
      expect(result.matched_skills).toContain('Python');
      expect(result.matched_skills).toContain('SQL');
    });

    it('should correctly identify missing_skills from project perspective', async () => {
      const project = makeProject({ skills_needed: ['Python', 'SQL', 'ML'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python']);
      expect(result.missing_skills).toContain('SQL');
      expect(result.missing_skills).toContain('ML');
    });

    it('should use skills_offered when skills_needed is empty', async () => {
      const project = makeProject({ skills_needed: [], skills_offered: ['Python', 'SQL'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python']);
      // 1/2 = 50% → Media
      expect(result.affinity_level).toBe('Media');
      expect(result.affinity_score).toBe(50);
    });

    it('should return score 0 when both skills_needed and skills_offered are empty', async () => {
      const project = makeProject({ skills_needed: [], skills_offered: [] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python']);
      expect(result.affinity_score).toBe(0);
    });

    it('should normalize skills case-insensitively (PYTHON matches python)', async () => {
      const project = makeProject({ skills_needed: ['python'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['PYTHON']);
      expect(result.affinity_score).toBe(100);
    });

    it('should handle leading/trailing whitespace in skill names', async () => {
      const project = makeProject({ skills_needed: ['python'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['  python  ']);
      expect(result.affinity_score).toBe(100);
    });

    it('should return project_id in the response', async () => {
      const project = makeProject();
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Machine Learning']);
      expect(result.project_id).toBe(projectId);
    });

    it('should round affinity_score to 2 decimal places', async () => {
      const project = makeProject({ skills_needed: ['A', 'B', 'C'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['A']);
      // 1/3 = 33.333... → 33.33
      expect(result.affinity_score.toString()).toMatch(/^\d+\.\d{1,2}$/);
    });

    it('should return affinity_level "Alta" when score is exactly 75.00', async () => {
      // 3/4 = 75%
      const project = makeProject({ skills_needed: ['A', 'B', 'C', 'D'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['A', 'B', 'C']);
      expect(result.affinity_score).toBe(75);
      expect(result.affinity_level).toBe('Alta');
    });

    it('should return affinity_level "Media" when score is exactly 40.00', async () => {
      // 2/5 = 40%
      const project = makeProject({ skills_needed: ['A', 'B', 'C', 'D', 'E'] });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['A', 'B']);
      expect(result.affinity_score).toBe(40);
      expect(result.affinity_level).toBe('Media');
    });

    it('should include skills from both skills_needed and skills_offered in matched_skills', async () => {
      const project = makeProject({
        skills_needed: ['Python'],
        skills_offered: ['SQL'],
      });
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await service.calculateScore(projectId, ['Python', 'SQL']);
      expect(result.matched_skills).toContain('Python');
      expect(result.matched_skills).toContain('SQL');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // getDiscoverableProfiles()
  // ════════════════════════════════════════════════════════════════════

  describe('getDiscoverableProfiles()', () => {
    const userId = 'current-user-uuid';

    it('should return profiles from the repository', async () => {
      const profiles = [makeProfile(), makeProfile({ id: 'profile-uuid-0002' })];
      mockQuery.mockResolvedValueOnce({ rows: profiles });
      const result = await service.getDiscoverableProfiles(userId);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no discoverable profiles exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getDiscoverableProfiles(userId);
      expect(result).toEqual([]);
    });

    it('should pass userId to the query to exclude own profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getDiscoverableProfiles(userId);
      const query = mockQuery.mock.calls[0][0];
      expect(query.values[0]).toBe(userId);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitInteraction()
  // ════════════════════════════════════════════════════════════════════

  describe('submitInteraction()', () => {
    const senderId = 'sender-user-uuid';
    const receiverProfileId = 'receiver-profile-uuid';

    const buildMockClient = (overrides: Record<string, jest.Mock> = {}) => ({
      query: jest.fn(),
      release: jest.fn(),
      ...overrides,
    });

    it('should throw AppError 404 ERR_FEED_POST_NOT_FOUND when receiver profile does not exist', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // profile check → not found
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(
        service.submitInteraction(senderId, receiverProfileId, 'like')
      ).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'ERR_FEED_POST_NOT_FOUND',
      });
    });

    it('should throw AppError 400 ERR_MOD_SELF_REPORT when sender tries to like themselves', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: receiverProfileId, user_id: senderId }] }) // profile found, same userId
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(
        service.submitInteraction(senderId, receiverProfileId, 'like')
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_MOD_SELF_REPORT',
      });
    });

    it('should return status=pending and chatChannelId=null when no reverse interaction exists (like)', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: receiverProfileId, user_id: 'other-user' }] }) // profile found
        .mockResolvedValueOnce({ rows: [] }) // sender profile query
        .mockResolvedValueOnce({ rows: [] }) // reverse interaction → none
        .mockResolvedValueOnce(undefined) // INSERT pending
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.submitInteraction(senderId, receiverProfileId, 'like');
      expect(result.status).toBe('pending');
      expect(result.chatChannelId).toBeNull();
    });

    it('should return status=accepted and a chatChannelId UUID when double-match occurs (like)', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);
      // getMatchedContactInfo after accepted
      mockQuery.mockResolvedValueOnce({ rows: [makeProfile()] });

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: receiverProfileId, user_id: 'other-user' }] }) // profile
        .mockResolvedValueOnce({ rows: [{ id: 'sender-profile-uuid' }] }) // sender profile
        .mockResolvedValueOnce({ rows: [{ id: 'reverse-interaction-uuid', status: 'pending' }] }) // reverse found
        .mockResolvedValueOnce(undefined) // UPDATE reverse → accepted
        .mockResolvedValueOnce(undefined) // INSERT sender → accepted
        .mockResolvedValueOnce(undefined) // UPDATE visibility
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.submitInteraction(senderId, receiverProfileId, 'like');
      expect(result.status).toBe('accepted');
      expect(result.chatChannelId).toBeDefined();
      expect(typeof result.chatChannelId).toBe('string');
    });

    it('should return status=rejected when action is dislike (no reverse interaction)', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: receiverProfileId, user_id: 'other-user' }] }) // profile
        .mockResolvedValueOnce({ rows: [] }) // sender profile
        .mockResolvedValueOnce({ rows: [] }) // no reverse
        .mockResolvedValueOnce(undefined) // INSERT rejected
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.submitInteraction(senderId, receiverProfileId, 'dislike');
      expect(result.status).toBe('rejected');
    });

    it('should release the client connection in the finally block even on error', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Unexpected DB error')); // crash during profile query

      await service.submitInteraction(senderId, receiverProfileId, 'like').catch(() => {});
      expect(client.release).toHaveBeenCalled();
    });

    it('should propagate unknown errors that are not EL_PERFIL_RECEPTOR_NO_EXISTE or AUTOLIKE', async () => {
      const client = buildMockClient();
      (pool.connect as jest.Mock).mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Foreign key constraint violation'));

      await expect(
        service.submitInteraction(senderId, receiverProfileId, 'like')
      ).rejects.toThrow('Foreign key constraint violation');
    });
  });
});
