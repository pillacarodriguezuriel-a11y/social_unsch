import { pool } from '../../../src/config/database';
import { redis } from '../../../src/config/redis';

afterAll(() => {
  // Reemplazar listeners por no-op para evitar errores no manejados al destruir contenedores
  pool.removeAllListeners('error');
  pool.on('error', () => {});

  redis.removeAllListeners('error');
  redis.on('error', () => {});

  try {
    redis.disconnect();
  } catch {}
});
