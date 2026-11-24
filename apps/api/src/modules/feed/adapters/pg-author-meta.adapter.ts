import { Pool } from 'pg';
import type { IAuthorMeta, IAuthorMetaReader } from '@social-unsch/feed-domain';

/**
 * Adaptador: lee metadatos del autor desde la tabla `users` de PostgreSQL.
 *
 * Encapsula el acceso cruzado del dominio Feed al dominio Identidad.
 * Este es el único punto en el que Feed accede explícitamente a datos
 * que no son de su propiedad. Cuando Feed se extraiga a un proceso
 * independiente, este adaptador se reemplazará por HttpAuthorMetaAdapter
 * sin cambiar FeedRepository ni FeedService.
 */
export class PgAuthorMetaAdapter implements IAuthorMetaReader {
  constructor(private readonly pool: Pool) {}

  async getAuthorMeta(userId: string): Promise<IAuthorMeta | null> {
    const result = await this.pool.query<IAuthorMeta>({
      name: 'fetch-post-author-meta',
      text: 'SELECT full_name, role FROM users WHERE id = $1',
      values: [userId],
    });
    return result.rows[0] ?? null;
  }
}
