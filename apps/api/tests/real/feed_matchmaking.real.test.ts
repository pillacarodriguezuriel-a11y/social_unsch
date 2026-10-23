import { Pool } from 'pg';
import { getTestPool } from './helpers/test-environment';
import { runMigrations } from '../../src/database/migrations/migrator';
import { loadCatalogs } from '../../src/database/migrations/load_catalogs';
import { FeedRepository } from '../../src/modules/feed/feed.repository';
import { MatchmakingRepository } from '../../src/modules/matchmaking/matchmaking.repository';

describe('Real Feed & Matchmaking Queries (PostgreSQL Real)', () => {
  let pool: Pool;
  let feedRepo: FeedRepository;
  let matchmakingRepo: MatchmakingRepository;

  const user1Id = 'aaaaaaaa-1111-1111-1111-111111111111';
  const user2Id = 'bbbbbbbb-2222-2222-2222-222222222222';
  const user3Id = 'cccccccc-3333-3333-3333-333333333333';

  beforeAll(async () => {
    pool = getTestPool();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);
    await loadCatalogs(pool);

    feedRepo = new FeedRepository();
    matchmakingRepo = new MatchmakingRepository();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM matchmaking_interactions');
    await pool.query('DELETE FROM matchmaking_profiles');
    await pool.query('DELETE FROM feed_posts');
    await pool.query('DELETE FROM users');

    // Insertar usuarios de prueba
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id)
       VALUES 
       ($1, 'Estudiante Sistemas 1', 'sistemas1@unsch.edu.pe', '$2b$12$hash1', 'student', 20),
       ($2, 'Estudiante Sistemas 2', 'sistemas2@unsch.edu.pe', '$2b$12$hash2', 'student', 20),
       ($3, 'Estudiante Minas', 'minas@unsch.edu.pe', '$2b$12$hash3', 'student', 21)`,
      [user1Id, user2Id, user3Id]
    );
  });

  describe('Feed Real Queries', () => {
    it('Crea posts con professional_school_id y recupera feed filtrado con metadata del autor', async () => {
      // 1. Crear posts con feedRepo
      const post1 = await feedRepo.create({
        userId: user1Id,
        content: 'Convocatoria Hackathon UNSCH 2026',
        facultyId: 5,
        schoolId: 20,
      });

      expect(post1.id).toBeDefined();
      expect(post1.author_name).toBe('Estudiante Sistemas 1');
      expect(post1.author_role).toBe('student');
      expect(post1.professional_school_id).toBe(20);

      // Crear otro post en escuela 21
      await feedRepo.create({
        userId: user3Id,
        content: 'Seminario de Minería y Medio Ambiente',
        facultyId: 6,
        schoolId: 21,
      });

      // 2. Consultar feed filtrado por escuela 20
      const feedSistemas = await feedRepo.findFiltered(undefined, 20);
      expect(feedSistemas.length).toBe(1);
      expect(feedSistemas[0].content).toBe('Convocatoria Hackathon UNSCH 2026');
      expect(feedSistemas[0].author_name).toBe('Estudiante Sistemas 1');

      // 3. Consultar feed filtrado por escuela 21
      const feedMinas = await feedRepo.findFiltered(undefined, 21);
      expect(feedMinas.length).toBe(1);
      expect(feedMinas[0].content).toBe('Seminario de Minería y Medio Ambiente');

      // 4. Los posts con is_visible = false no deben figurar en el feed
      await pool.query('UPDATE feed_posts SET is_visible = false WHERE id = $1', [post1.id]);
      const feedAfterHide = await feedRepo.findFiltered(undefined, 20);
      expect(feedAfterHide.length).toBe(0);
    });
  });

  describe('Matchmaking Real Queries & State Machine', () => {
    it('Transiciona correctamente en Double Match, revela contactos y respeta privacidad', async () => {
      // 1. Crear perfiles de matchmaking con enum project_type valido
      const profile1Res = await pool.query(
        `INSERT INTO matchmaking_profiles (user_id, project_type, description, is_visible)
         VALUES ($1, 'undergraduate_thesis', 'Desarrollo de IA para salud', true)
         RETURNING id`,
        [user1Id]
      );
      const profile1Id = profile1Res.rows[0].id;

      const profile2Res = await pool.query(
        `INSERT INTO matchmaking_profiles (user_id, project_type, description, is_visible)
         VALUES ($1, 'undergraduate_thesis', 'Backend y bases de datos distribuidas', true)
         RETURNING id`,
        [user2Id]
      );
      const profile2Id = profile2Res.rows[0].id;

      // 2. Comprobar que getDiscoverableProfiles para User 1 no muestra su propio perfil
      const discoverableForUser1 = await matchmakingRepo.getDiscoverableProfiles(user1Id);
      expect(discoverableForUser1.length).toBe(1);
      expect(discoverableForUser1[0].id).toBe(profile2Id);
      // Garantizar privacidad: datos de contacto ocultos antes del match
      expect(discoverableForUser1[0].email).toBeUndefined();

      // 3. User 1 da like a Perfil 2 -> Estado 'pending'
      const step1 = await matchmakingRepo.submitInteraction(user1Id, profile2Id, 'like');
      expect(step1.status).toBe('pending');
      expect(step1.chatChannelId).toBeNull();

      // Verificar que ahora Perfil 2 no vuelve a aparecer en descubrimientos de User 1
      const discoverableAfterLike = await matchmakingRepo.getDiscoverableProfiles(user1Id);
      expect(discoverableAfterLike.length).toBe(0);

      // 4. User 2 da like de vuelta a Perfil 1 -> Doble Match Handshake ('accepted')
      const step2 = await matchmakingRepo.submitInteraction(user2Id, profile1Id, 'like');
      expect(step2.status).toBe('accepted');
      expect(step2.chatChannelId).toBeDefined();

      // 5. Tras el match mutuo, ambos perfiles pueden acceder a la información de contacto desvelada
      const matchContactForUser1 = await matchmakingRepo.getMatchedContactInfo(user1Id, profile2Id);
      expect(matchContactForUser1).not.toBeNull();
      expect(matchContactForUser1?.email).toBe('sistemas2@unsch.edu.pe');
      expect(matchContactForUser1?.full_name).toBe('Estudiante Sistemas 2');

      const matchContactForUser2 = await matchmakingRepo.getMatchedContactInfo(user2Id, profile1Id);
      expect(matchContactForUser2).not.toBeNull();
      expect(matchContactForUser2?.email).toBe('sistemas1@unsch.edu.pe');

      // 6. Rechazo de autolike
      await expect(matchmakingRepo.submitInteraction(user1Id, profile1Id, 'like')).rejects.toThrow(
        'AUTOLIKE_NO_PERMITIDO'
      );
    });
  });
});
