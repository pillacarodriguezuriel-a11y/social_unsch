import { pool } from '../../config/database';

export interface FeedPost {
  id: string; // UUID v4
  user_id: string; // UUID v4
  faculty_id: number | null;
  professional_school_id: number | null;
  content: string;
  is_visible: boolean;
  created_at: Date;
  author_name: string;
  author_role: string;
}

export class FeedRepository {
  /**
   * Recupera las publicaciones del feed aplicando filtros académicos, paginación e índices B-Tree.
   * Selecciona únicamente registros visibles (is_visible = true) y ordena por fecha descendente.
   */
  async findFiltered(
    facultyId?: number,
    schoolId?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<FeedPost[]> {
    let queryText = `
      SELECT f.id, f.user_id, f.faculty_id, f.professional_school_id, f.content, f.is_visible, f.created_at,
             u.full_name as author_name, u.role as author_role
      FROM feed_posts f
      INNER JOIN users u ON f.user_id = u.id
      WHERE f.is_visible = true
    `;

    const values: any[] = [];
    let paramIndex = 1;

    // Estos filtros aseguran el uso óptimo del índice compuesto (faculty_id, school_id, created_at DESC)
    if (facultyId) {
      queryText += ` AND f.faculty_id = $${paramIndex}`;
      values.push(facultyId);
      paramIndex++;
    }

    if (schoolId) {
      queryText += ` AND f.professional_school_id = $${paramIndex}`;
      values.push(schoolId);
      paramIndex++;
    }

    queryText += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const query = {
      name: `fetch-feed-filtered-${facultyId || 0}-${schoolId || 0}`,
      text: queryText,
      values,
    };

    const result = await pool.query<FeedPost>(query);
    return result.rows;
  }

  /**
   * Registra una nueva publicación en el repositorio persistente (PostgreSQL).
   */
  async create(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<FeedPost> {
    const { userId, content, facultyId = null, schoolId = null } = input;

    const query = {
      name: 'insert-new-feed-post',
      text: `
        INSERT INTO feed_posts (
          user_id, 
          faculty_id, 
          professional_school_id, 
          content, 
          is_visible, 
          created_at
        ) VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        RETURNING id, user_id, faculty_id, professional_school_id, content, is_visible, created_at
      `,
      values: [userId, facultyId, schoolId, content],
    };

    const result = await pool.query(query);
    const post = result.rows[0];

    // Obtener los datos del autor para retornar un objeto FeedPost completo
    const authorQuery = {
      name: 'fetch-post-author-meta',
      text: 'SELECT full_name, role FROM users WHERE id = $1',
      values: [userId],
    };
    const authorResult = await pool.query(authorQuery);
    const author = authorResult.rows[0];

    return {
      ...post,
      author_name: author.full_name,
      author_role: author.role,
    };
  }
}
