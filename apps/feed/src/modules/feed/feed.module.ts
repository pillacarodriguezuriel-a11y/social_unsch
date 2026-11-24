import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { FeedService } from '@social-unsch/feed-domain';
import { FeedRepository } from './feed.repository';
import { FeedController } from './feed.controller';

export interface FeedModuleDeps {
  pool: Pool;
  authGuard: RequestHandler;
}

export function createFeedModule({ pool, authGuard }: FeedModuleDeps): Router {
  const repository = new FeedRepository(pool);
  const service = new FeedService(repository);
  const controller = new FeedController(service);

  const router = Router();
  router.get('/', authGuard, controller.getFeed);
  router.post('/', authGuard, controller.createPost);
  return router;
}
