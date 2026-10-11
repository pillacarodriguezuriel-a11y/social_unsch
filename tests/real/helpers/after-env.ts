import { pool } from '../../../src/config/database';
import { redis } from '../../../src/config/redis';

afterAll(async () => {
  // Cierre limpio y explícito de recursos sin enmascarar errores
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
});
