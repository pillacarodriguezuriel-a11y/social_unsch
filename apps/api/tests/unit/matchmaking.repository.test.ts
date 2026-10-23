/**
 * Unit Test Suite: MatchmakingRepository
 *
 * Mocks: pg pool (query + connect for transaction tests)
 * Covers:
 *   - findProjectById(): found, not found
 *   - getDiscoverableProfiles(): results, empty
 *   - getMatchedContactInfo(): found, not found
 *   - submitInteraction() transactional paths are exercised via service tests;
 *     here we test the repository plumbing independently using a mocked client
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../../src/config/database';
import { MatchmakingRepository, MatchmakingProject, MatchmakingProfile } from '../../src/modules/matchmaking/matchmaking.repository';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;

const makeProject = (overrides: Partial<MatchmakingProject> = {}): MatchmakingProject => ({
  id: 'proj-uuid-001',
  owner_id: 'owner-uuid-001',
  faculty_id: 1,
  title: 'Test Project',
  description: 'Description',
  project_type: 'investigacion',
  skills_offered: ['Python'],
  skills_needed: ['ML'],
  max_members: 4,
  current_members: 1,
  is_open: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeProfile = (overrides: Partial<MatchmakingProfile> = {}): MatchmakingProfile => ({
  id: 'profile-uuid-001',
  user_id: 'user-uuid-001',
  project_type: 'investigacion',
  description: 'Estudiante UNSCH',
  is_visible: true,
  created_at: new Date(),
  full_name: 'Ana Quispe',
  role: 'student',
  ...overrides,
});

describe('MatchmakingRepository', () => {
  let repo: MatchmakingRepository;

  beforeEach(() => {
    repo = new MatchmakingRepository();
  });

  // ════════════════════════════════════════════════════════════════════
  // findProjectById()
  // ════════════════════════════════════════════════════════════════════

  describe('findProjectById()', () => {
    it('should return a MatchmakingProject when the project exists', async () => {
      const project = makeProject();
      mockQuery.mockResolvedValueOnce({ rows: [project], rowCount: 1 });
      const result = await repo.findProjectById('proj-uuid-001');
      expect(result).toEqual(project);
    });

    it('should return null when no project matches the given id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await repo.findProjectById('non-existent-uuid');
      expect(result).toBeNull();
    });

    it('should pass the projectId in the query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findProjectById('some-project-id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe('some-project-id');
    });

    it('should use a named prepared statement', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findProjectById('id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.name).toBeDefined();
    });

    it('should select from matchmaking_projects table', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.findProjectById('id');
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('matchmaking_projects');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // getDiscoverableProfiles()
  // ════════════════════════════════════════════════════════════════════

  describe('getDiscoverableProfiles()', () => {
    const userId = 'requesting-user-uuid';

    it('should return an array of profiles', async () => {
      const profiles = [makeProfile(), makeProfile({ id: 'profile-uuid-002' })];
      mockQuery.mockResolvedValueOnce({ rows: profiles });
      const result = await repo.getDiscoverableProfiles(userId);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no discoverable profiles exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await repo.getDiscoverableProfiles(userId);
      expect(result).toEqual([]);
    });

    it('should pass userId in query values to exclude own profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getDiscoverableProfiles(userId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values[0]).toBe(userId);
    });

    it('should filter only visible profiles (is_visible = true)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getDiscoverableProfiles(userId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('is_visible = true');
    });

    it('should JOIN users table to get full_name and role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getDiscoverableProfiles(userId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('JOIN users');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // getMatchedContactInfo()
  // ════════════════════════════════════════════════════════════════════

  describe('getMatchedContactInfo()', () => {
    const userId = 'req-user-uuid';
    const receiverProfileId = 'recv-profile-uuid';

    it('should return a MatchmakingProfile when match exists', async () => {
      const profile = makeProfile({ email: 'ana@unsch.edu.pe' });
      mockQuery.mockResolvedValueOnce({ rows: [profile] });
      const result = await repo.getMatchedContactInfo(userId, receiverProfileId);
      expect(result).toEqual(profile);
    });

    it('should return null when no accepted match is found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await repo.getMatchedContactInfo(userId, receiverProfileId);
      expect(result).toBeNull();
    });

    it('should pass receiverProfileId and userId in query values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getMatchedContactInfo(userId, receiverProfileId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.values).toContain(receiverProfileId);
      expect(callArg.values).toContain(userId);
    });

    it('should check for status = accepted in the subquery', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getMatchedContactInfo(userId, receiverProfileId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain("'accepted'");
    });

    it('should select email field (unmasked on accepted match)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.getMatchedContactInfo(userId, receiverProfileId);
      const callArg = mockQuery.mock.calls[0][0];
      expect(callArg.text).toContain('u.email');
    });
  });
});
