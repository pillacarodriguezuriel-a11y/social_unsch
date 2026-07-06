import { pool } from '../../config/database';

export interface MatchmakingProject {
  id: string; // UUID
  owner_id: string; // UUID
  faculty_id: number | null;
  title: string;
  description: string;
  project_type: string;
  skills_offered: string[];
  skills_needed: string[];
  max_members: number;
  current_members: number;
  is_open: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MatchmakingProfile {
  id: string; // UUID
  user_id: string; // UUID
  project_type: string;
  description: string;
  is_visible: boolean;
  created_at: Date;
  full_name?: string;
  role?: string;
  email?: string; // Solo visible si hay match aceptado
  phone?: string; // Solo visible si hay match aceptado
}

export interface MatchmakingInteraction {
  id: string; // UUID
  sender_id: string; // UUID
  receiver_profile_id: string; // UUID
  status: 'pending' | 'accepted' | 'rejected';
  cooldown_until: Date | null;
  created_at: Date;
  chat_channel_id: string | null;
}

export class MatchmakingRepository {
  /**
   * Busca un proyecto de matchmaking por ID.
   */
  async findProjectById(projectId: string): Promise<MatchmakingProject | null> {
    const query = {
      name: 'find-matchmaking-project-by-id',
      text: 'SELECT * FROM matchmaking_projects WHERE id = $1',
      values: [projectId],
    };
    const result = await pool.query<MatchmakingProject>(query);
    return result.rows[0] || null;
  }

  /**
   * Obtiene la lista de perfiles descubribles (DISCOVERABLE) aplicando filtros de privacidad estricta.
   * Excluye perfiles propios, perfiles con interacciones activas/cooldown y oculta datos de contacto (Ley N° 29733).
   */
  async getDiscoverableProfiles(userId: string): Promise<MatchmakingProfile[]> {
    const query = {
      name: 'get-discoverable-matchmaking-profiles',
      text: `
        SELECT p.id, p.user_id, p.project_type, p.description, p.created_at,
               u.full_name, u.role
        FROM matchmaking_profiles p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.is_visible = true
          AND p.user_id != $1
          AND NOT EXISTS (
            SELECT 1 
            FROM matchmaking_interactions i 
            WHERE i.sender_id = $1 
              AND i.receiver_profile_id = p.id
              AND (
                i.status = 'pending' 
                OR i.status = 'accepted'
                OR (i.status = 'rejected' AND i.cooldown_until > NOW())
              )
          )
      `,
      values: [userId],
    };
    const result = await pool.query<MatchmakingProfile>(query);
    return result.rows;
  }

  /**
   * Ejecuta transaccionalmente el registro de interacción y la máquina de estados de doble match.
   */
  async submitInteraction(
    senderId: string,
    receiverProfileId: string,
    action: 'like' | 'dislike'
  ): Promise<{ status: string; chatChannelId: string | null }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener información del perfil receptor (incluyendo su user_id)
      const profileQuery = await client.query(
        'SELECT id, user_id FROM matchmaking_profiles WHERE id = $1',
        [receiverProfileId]
      );
      if (profileQuery.rows.length === 0) {
        throw new Error('EL_PERFIL_RECEPTOR_NO_EXISTE');
      }
      const receiverUserId = profileQuery.rows[0].user_id;

      // Evitar auto-likes
      if (receiverUserId === senderId) {
        throw new Error('AUTOLIKE_NO_PERMITIDO');
      }

      // 2. Obtener el perfil propio del emisor (sender) para el cruce de visibilidad
      const senderProfileQuery = await client.query(
        'SELECT id FROM matchmaking_profiles WHERE user_id = $1',
        [senderId]
      );
      const senderProfileId = senderProfileQuery.rows[0]?.id;

      // 3. Buscar si existe una interacción pendiente en la dirección contraria (Double Match Handshake)
      const reverseQuery = await client.query(
        `SELECT id, status FROM matchmaking_interactions 
         WHERE sender_id = $1 AND receiver_profile_id = $2 AND status = 'pending'`,
        [receiverUserId, senderProfileId]
      );

      let status: 'pending' | 'accepted' | 'rejected' = 'pending';
      let chatChannelId: string | null = null;

      if (reverseQuery.rows.length > 0) {
        const existingInteractionId = reverseQuery.rows[0].id;

        if (action === 'like') {
          status = 'accepted';
          chatChannelId = crypto.randomUUID();

          // Transición Aceptado: Actualizar la interacción inversa a aceptada
          await client.query(
            `UPDATE matchmaking_interactions 
             SET status = 'accepted', chat_channel_id = $1 
             WHERE id = $2`,
            [chatChannelId, existingInteractionId]
          );

          // Insertar la interacción simétrica de forma que ambas queden registradas
          await client.query(
            `INSERT INTO matchmaking_interactions (sender_id, receiver_profile_id, status, chat_channel_id) 
             VALUES ($1, $2, 'accepted', $3)
             ON CONFLICT (sender_id, receiver_profile_id) 
             DO UPDATE SET status = 'accepted', chat_channel_id = $3`,
            [senderId, receiverProfileId, chatChannelId]
          );

          // Ambos perfiles alteran su visibilidad tras el Match
          if (senderProfileId) {
            await client.query(
              'UPDATE matchmaking_profiles SET is_visible = false WHERE id IN ($1, $2)',
              [senderProfileId, receiverProfileId]
            );
          }
        } else {
          status = 'rejected';
          // Transición Rechazado: Poner en cooldown
          await client.query(
            `UPDATE matchmaking_interactions 
             SET status = 'rejected', cooldown_until = NOW() + INTERVAL '30 days' 
             WHERE id = $1`,
            [existingInteractionId]
          );

          await client.query(
            `INSERT INTO matchmaking_interactions (sender_id, receiver_profile_id, status, cooldown_until) 
             VALUES ($1, $2, 'rejected', NOW() + INTERVAL '30 days')
             ON CONFLICT (sender_id, receiver_profile_id) 
             DO UPDATE SET status = 'rejected', cooldown_until = NOW() + INTERVAL '30 days'`,
            [senderId, receiverProfileId]
          );
        }
      } else {
        // No existe interacción inversa previa, registrar una nueva interacción
        if (action === 'like') {
          status = 'pending';
          await client.query(
            `INSERT INTO matchmaking_interactions (sender_id, receiver_profile_id, status) 
             VALUES ($1, $2, 'pending')
             ON CONFLICT (sender_id, receiver_profile_id) 
             DO UPDATE SET status = 'pending', cooldown_until = NULL`,
            [senderId, receiverProfileId]
          );
        } else {
          status = 'rejected';
          await client.query(
            `INSERT INTO matchmaking_interactions (sender_id, receiver_profile_id, status, cooldown_until) 
             VALUES ($1, $2, 'rejected', NOW() + INTERVAL '30 days')
             ON CONFLICT (sender_id, receiver_profile_id) 
             DO UPDATE SET status = 'rejected', cooldown_until = NOW() + INTERVAL '30 days'`,
            [senderId, receiverProfileId]
          );
        }
      }

      await client.query('COMMIT');
      return { status, chatChannelId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene la información de contacto de un match aceptado (Doble confirmación).
   */
  async getMatchedContactInfo(userId: string, receiverProfileId: string): Promise<MatchmakingProfile | null> {
    const query = {
      name: 'get-matched-contact-info',
      text: `
        SELECT p.id, p.user_id, p.project_type, p.description,
               u.full_name, u.role, u.email
        FROM matchmaking_profiles p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.id = $1
          AND EXISTS (
            SELECT 1 
            FROM matchmaking_interactions i
            WHERE i.sender_id = $2 
              AND i.receiver_profile_id = p.id
              AND i.status = 'accepted'
          )
      `,
      values: [receiverProfileId, userId],
    };
    const result = await pool.query<MatchmakingProfile>(query);
    return result.rows[0] || null;
  }
}
