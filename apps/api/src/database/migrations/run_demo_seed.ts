import { loadDemoSeed } from './load_demo_seed';
import { pool } from '../../config/database';

async function main() {
  console.log('=== SOCIAL-UNSCH: CARGA DE DATOS DEMO (OPCIONAL/LOCAL) ===');
  try {
    const result = await loadDemoSeed();
    console.log('[Éxito] Datos de demostración cargados:', result);
  } catch (error) {
    console.error('[Bloqueo / Fallo]:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
