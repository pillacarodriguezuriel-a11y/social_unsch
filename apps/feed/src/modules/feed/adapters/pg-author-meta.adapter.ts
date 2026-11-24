import type { Pool } from 'pg';
import type { IAuthorMeta, IAuthorMetaReader } from '@social-unsch/feed-domain';

export class PgAuthorMetaAdapter implements IAuthorMetaReader {
  constructor(private readonly pool: Pool) {}

  async getAuthorMeta(userId: string): Promise<IAuthorMeta | null> {
    const result = await this.pool.query<IAuthorMeta>({
      name: 'feed-svc-fetch-author-meta',
      text: 'SELECT full_name, role FROM users WHERE id = $1',
      values: [userId],
    });
    return result.rows[0] ?? null;
  }
}
