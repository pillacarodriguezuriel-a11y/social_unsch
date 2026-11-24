import type { Pool } from 'pg';
import type { IFeedPost, IFeedRepository, IAuthorMetaReader } from '@social-unsch/feed-domain';
import { PgAuthorMetaAdapter } from './adapters/pg-author-meta.adapter';

export class FeedRepository implements IFeedRepository {
  private readonly authorMetaReader: IAuthorMetaReader;

  constructor(
    private readonly pool: Pool,
    authorMetaReader?: IAuthorMetaReader
  ) {
    this.authorMetaReader = authorMetaReader ?? new PgAuthorMetaAdapter(pool);
  }

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

    const result = await this.pool.query<IFeedPost>({
      name: `feed-svc-filtered-${facultyId || 0}-${schoolId || 0}`,
      text: queryText,
      values,
    });
    return result.rows;
  }

  async create(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<IFeedPost> {
    const { userId, content, facultyId = null, schoolId = null } = input;

    const result = await this.pool.query({
      name: 'feed-svc-insert-post',
      text: `
        INSERT INTO feed_posts (user_id, faculty_id, professional_school_id, content, is_visible, created_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        RETURNING id, user_id, faculty_id, professional_school_id, content, is_visible, created_at
      `,
      values: [userId, facultyId, schoolId, content],
    });
    const post = result.rows[0];
    const author = await this.authorMetaReader.getAuthorMeta(userId);

    return {
      ...post,
      author_name: author?.full_name ?? '',
      author_role: author?.role ?? '',
    };
  }
}
