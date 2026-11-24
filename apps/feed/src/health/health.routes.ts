import { Request, Response, Router } from 'express';
import type { Pool } from 'pg';

export interface FeedHealthOptions {
  pool: Pool;
  timeoutMs?: number;
}

export function createFeedHealthRouter({ pool, timeoutMs = 2000 }: FeedHealthOptions): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'social-unsch-feed' });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });

    try {
      const dbPromise = pool
        .query('SELECT 1')
        .then(() => true)
        .catch(() => false);
      const isDbUp = await Promise.race([dbPromise, timeoutPromise]);

      if (isDbUp) {
        res.status(200).set('Cache-Control', 'no-store').json({
          status: 'ready',
          service: 'social-unsch-feed',
          checks: { database: 'up' },
        });
      } else {
        res.status(503).set('Cache-Control', 'no-store').json({
          status: 'unavailable',
          service: 'social-unsch-feed',
          checks: { database: 'down' },
        });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  });

  return router;
}
