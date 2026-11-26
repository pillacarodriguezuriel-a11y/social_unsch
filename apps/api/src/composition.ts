import { pool } from './config/database';
import { ServerConfig } from './config/env';
import { createRedisClient } from './config/redis';
import { AppDependencies } from './app';
import { createLocalRadarModule, RadarModule } from './modules/radar/radar.module';
import { createRadarProxyModule } from './modules/radar/radar.proxy';
import { createFeedRouter } from './modules/feed/feed.module';
import { createFeedProxyModule } from './modules/feed/feed.proxy';

export interface AppResources {
  deps: AppDependencies;
  /** Cierra las conexiones abiertas por la composición. Idempotente. */
  close(): Promise<void>;
}

/**
 * Composición explícita del proceso: único lugar que crea conexiones externas.
 * - PostgreSQL: pool compartido de config/database (conecta en la primera consulta).
 * - Radar local: crea el cliente Redis y lo inyecta en el módulo.
 * - Radar proxy: no abre Redis en este proceso.
 */
export function createAppResources(config: ServerConfig): AppResources {
  const closers: Array<() => Promise<unknown>> = [];

  let radar: RadarModule;
  if (config.radar.mode === 'proxy') {
    const proxyModule = createRadarProxyModule({ target: config.radar.target, timeoutMs: config.radar.timeoutMs, healthPath: '/health/ready' });
    radar = proxyModule;
    if (proxyModule.close) closers.push(() => Promise.resolve(proxyModule.close!()));
  } else {
    const redis = createRedisClient(config.redisUrl);
    closers.push(() => redis.quit().catch(() => redis.disconnect()));
    radar = createLocalRadarModule({ redis });
  }
  closers.push(() => pool.end());

  // Feed: local (default) o proxy hacia apps/feed
  let feedRouter: AppDependencies['feedRouter'];
  // Solo en modo proxy aporta información: en modo local el Feed vive en este
  // proceso y su dependencia real ya se reporta como `database`.
  let feedReadiness: (() => Promise<boolean>) | null = null;
  if (config.feed.mode === 'proxy') {
    const feedProxy = createFeedProxyModule({
      target: config.feed.target,
      timeoutMs: config.feed.timeoutMs,
      healthPath: '/health/ready',
    });
    feedRouter = feedProxy.router;
    feedReadiness = () => feedProxy.checkReady();
    if (feedProxy.close) closers.push(() => Promise.resolve(feedProxy.close!()));
  } else {
    feedRouter = createFeedRouter({ pool: pool as any });
  }

  let closed: Promise<void> | null = null;
  return {
    deps: {
      radar,
      feedRouter,
      allowedOrigins: config.allowedOrigins,
      readinessChecks: [
        {
          name: 'database',
          critical: true,
          check: async () => {
            await pool.query('SELECT 1');
            return true;
          },
        },
        { name: 'radar', critical: false, check: () => radar.checkReady() },
        ...(feedReadiness ? [{ name: 'feed', critical: false, check: feedReadiness }] : []),
      ],
    },
    close() {
      if (!closed) {
        closed = Promise.allSettled(closers.map((fn) => fn())).then(() => undefined);
      }
      return closed;
    },
  };
}
