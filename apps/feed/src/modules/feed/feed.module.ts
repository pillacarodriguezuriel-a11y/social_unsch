import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import {
  FeedHttpHandlers,
  FeedService,
  PgAuthorMetaAdapter,
  PgFeedRepository,
} from '@social-unsch/feed-domain';
import { FeedController } from './feed.controller';

export interface FeedModuleDeps {
  pool: Pool;
  authGuard: RequestHandler;
}

/**
 * Prefijo propio de las consultas preparadas de este servicio. `apps/api` usa
 * otro: así, al compartir PostgreSQL, un mismo nombre no puede quedar asociado
 * a dos textos distintos en el pooler.
 */
export const FEED_STATEMENT_PREFIX = 'feed-svc';

export function createFeedModule({ pool, authGuard }: FeedModuleDeps): Router {
  const authorMetaReader = new PgAuthorMetaAdapter({
    db: pool,
    statementPrefix: FEED_STATEMENT_PREFIX,
  });
  const repository = new PgFeedRepository({
    db: pool,
    authorMetaReader,
    statementPrefix: FEED_STATEMENT_PREFIX,
  });
  const handlers = new FeedHttpHandlers(new FeedService(repository));
  const controller = new FeedController(handlers);

  const router = Router();
  router.get('/', authGuard, controller.getFeed);
  router.post('/', authGuard, controller.createPost);
  return router;
}
