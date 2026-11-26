import { pool as defaultPool } from '../../config/database';
import { PgAuthorMetaAdapter, PgFeedRepository } from '@social-unsch/feed-domain';
import type { IAuthorMetaReader } from '@social-unsch/feed-domain';
import type { Pool } from 'pg';

/**
 * Prefijo propio de las consultas preparadas de este proceso. `apps/feed` usa
 * otro: así, al compartir PostgreSQL, un mismo nombre no puede quedar asociado
 * a dos textos distintos en el pooler.
 */
export const FEED_STATEMENT_PREFIX = 'feed-api';

/**
 * Repositorio Feed de la API en modo local.
 *
 * El SQL vive una sola vez en `@social-unsch/feed-domain`: aquí solo se fija el
 * pool por defecto y el prefijo de consultas preparadas.
 */
export class FeedRepository extends PgFeedRepository {
  constructor(pool: Pool = defaultPool as unknown as Pool, authorMetaReader?: IAuthorMetaReader) {
    super({
      db: pool,
      authorMetaReader:
        authorMetaReader ?? new PgAuthorMetaAdapter({ db: pool, statementPrefix: FEED_STATEMENT_PREFIX }),
      statementPrefix: FEED_STATEMENT_PREFIX,
    });
  }
}
