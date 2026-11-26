import { Router } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middlewares/auth.middleware';
import { FeedHttpHandlers, FeedService } from '@social-unsch/feed-domain';
import { FeedRepository } from './feed.repository';
import { FeedController } from './feed.controller';

export interface FeedModuleDeps {
  pool: Pool;
}

/**
 * Punto de composición del dominio Feed en modo local.
 *
 * Reúne las dependencias y expone únicamente el router HTTP. Es el punto que
 * `composition.ts` sustituye por `feed.proxy.ts` cuando `FEED_MODE=proxy`, sin
 * cambiar `app.ts`.
 */
export function createFeedRouter(deps: FeedModuleDeps): Router {
  const feedRepository = new FeedRepository(deps.pool);
  const handlers = new FeedHttpHandlers(new FeedService(feedRepository));
  const feedController = new FeedController(handlers);

  const router = Router();
  router.get('/', requireAuth, feedController.getFeed);
  router.post('/', requireAuth, feedController.createPost);
  return router;
}
