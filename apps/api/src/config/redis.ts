import Redis from 'ioredis';

/** Destino usado en desarrollo cuando REDIS_URL no está definida. */
export const DEFAULT_LOCAL_REDIS_URL = 'redis://127.0.0.1:6379';

/**
 * Crea el cliente Redis del radar. Solo lo invoca la composición del proceso (composition.ts):
 * importar este archivo no abre conexiones. TLS se activa con el esquema rediss://.
 * Los registros nunca incluyen la URL, que puede contener credenciales.
 */
export function createRedisClient(url: string): Redis {
  const isTls = url.startsWith('rediss://');
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // Reconexión resiliente: reintentos con backoff exponencial con techo (máximo 3000ms),
      // permitiendo recuperación tras fallos temporales sin encolar indefinidamente.
      return Math.min(times * 100, 3000);
    },
    tls: isTls ? {} : undefined,
  });

  client.on('connect', () => {
    console.log('[Redis]: Conectado exitosamente al servidor Redis.');
  });
  client.on('error', (err: Error) => {
    console.error('[Redis]: Error de conexión en el cliente Redis:', err.message);
  });

  return client;
}
