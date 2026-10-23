import { pool } from '../../../src/config/database';

/**
 * Cierre explícito, por archivo de pruebas, del pool compartido que usan los repositorios.
 * Desde la etapa 3 no existe un cliente Redis global: cada prueba crea y cierra el suyo.
 */
afterAll(async () => {
  await pool.end().catch(() => undefined);
});
