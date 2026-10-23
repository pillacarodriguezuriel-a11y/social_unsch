import { Request, Response, Router } from 'express';
import type Redis from 'ioredis';

export interface HealthCheckOptions {
  redis: Pick<Redis, 'ping'>;
  timeoutMs?: number;
}

export function createRadarHealthRouter({ redis, timeoutMs = 2000 }: HealthCheckOptions): Router {
  const router = Router();

  // Liveness: indica si el proceso Express está vivo y aceptando solicitudes
  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'social-unsch-radar' });
  });

  // Readiness: indica si Redis está conectado y respondiendo a comandos
  router.get('/ready', async (_req: Request, res: Response) => {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });

    try {
      const pingPromise = redis.ping().then((res) => res === 'PONG').catch(() => false);
      const isRedisUp = await Promise.race([pingPromise, timeoutPromise]);

      if (isRedisUp) {
        res.status(200).set('Cache-Control', 'no-store').json({
          status: 'ready',
          service: 'social-unsch-radar',
          checks: {
            redis: 'up',
          },
        });
      } else {
        res.status(503).set('Cache-Control', 'no-store').json({
          status: 'unavailable',
          service: 'social-unsch-radar',
          checks: {
            redis: 'down',
          },
        });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  });

  return router;
}
