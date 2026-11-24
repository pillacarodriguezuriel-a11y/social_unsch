import { pool as defaultPool } from '../../config/database';
import { IFeedPost, IFeedRepository, IAuthorMetaReader } from './ports';
import { PgAuthorMetaAdapter } from './adapters/pg-author-meta.adapter';
import type { Pool } from 'pg';

export type { IFeedPost as FeedPost };

export class FeedRepository implements IFeedRepository {
  private readonly pool: Pool;
  private readonly authorMetaReader: IAuthorMetaReader;

  constructor(
    pool: Pool = defaultPool as unknown as Pool,
    authorMetaReader?: IAuthorMetaReader
  ) {
    this.pool = pool;
    this.authorMetaReader = authorMetaReader ?? new PgAuthorMetaAdapter(pool);
  }

  /**
   * Recupera publicaciones del feed con filtros académicos y paginación.
   * Acceso cruzado a Identidad: INNER JOIN con `users` (documentado en ports.ts).
   */
  async findFiltered(
    facultyId?: number,
    schoolId?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<IFeedPost[]> {
    let queryText = `
      SELECT f.id, f.user_id, f.faculty_id, f.professional_school_id, f.content, f.is_visible, f.created_at,
             u.full_name as author_name, u.role as author_role
      FROM feed_posts f
      INNER JOIN users u ON f.user_id = u.id
      WHERE f.is_visible = true
    `;

    const values: unknown[] = [];
    let paramIndex = 1;

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

    const result = await this.pool.query<IFeedPost>(query);
    return result.rows;
  }

  /**
   * Registra una nueva publicación y adjunta los metadatos del autor.
   * El acceso a datos del autor está encapsulado en IAuthorMetaReader.
   */
  async create(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<IFeedPost> {
    const { userId, content, facultyId = null, schoolId = null } = input;

    const insertQuery = {
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

    const result = await this.pool.query(insertQuery);
    const post = result.rows[0];

    const author = await this.authorMetaReader.getAuthorMeta(userId);

    return {
      ...post,
      author_name: author?.full_name ?? '',
      author_role: author?.role ?? '',
    };
  }
}
