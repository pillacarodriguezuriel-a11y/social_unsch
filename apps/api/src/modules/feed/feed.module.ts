import { Router } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middlewares/auth.middleware';
import { PgAuthorMetaAdapter } from './adapters/pg-author-meta.adapter';
import { FeedRepository } from './feed.repository';
import { FeedService } from '@social-unsch/feed-domain';
import { FeedController } from './feed.controller';

export interface FeedModuleDeps {
  pool: Pool;
}

/**
 * Punto de composición del dominio Feed.
 *
 * Reúne todas las dependencias internas y expone únicamente el router HTTP.
 * Este es el punto de sustitución que, en la etapa de extracción, se
 * reemplazaría por un proxy o un router hacia un servicio independiente,
 * sin cambiar app.ts ni composition.ts.
 */
export function createFeedRouter(deps: FeedModuleDeps): Router {
  const authorMetaReader = new PgAuthorMetaAdapter(deps.pool);
  const feedRepository = new FeedRepository(deps.pool, authorMetaReader);
  const feedService = new FeedService(feedRepository);
  const feedController = new FeedController(feedService);

  const router = Router();
  router.get('/', requireAuth, feedController.getFeed);
  router.post('/', requireAuth, feedController.createPost);
  return router;
}
