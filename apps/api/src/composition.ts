import { pool } from './config/database';
import { ServerConfig } from './config/env';
import { createRedisClient } from './config/redis';
import { AppDependencies } from './app';
import { createLocalRadarModule, RadarModule } from './modules/radar/radar.module';
import { createRadarProxyModule } from './modules/radar/radar.proxy';

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

  let closed: Promise<void> | null = null;
  return {
    deps: {
      radar,
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
