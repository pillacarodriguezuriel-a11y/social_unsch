import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Inicializar cliente Redis global con ioredis
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      console.warn('[Redis]: Se alcanzó el límite de reintentos. El servidor continuará ejecutándose sin Redis (Radar en estado degradado o caché local).');
      return null; // Detiene el bucle de reintentos infinitos
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('[Redis]: Conectado exitosamente al servidor Redis.');
});

redis.on('error', (err) => {
  console.error('[Redis]: Error de conexión en el cliente Redis:', err);
});
