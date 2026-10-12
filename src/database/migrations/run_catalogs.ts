import { loadCatalogs } from './load_catalogs';
import { pool } from '../../config/database';

async function main() {
  console.log('=== SOCIAL-UNSCH: CARGA DE CATÁLOGOS OPERATIVOS ===');
  try {
    const result = await loadCatalogs();
    console.log('[Éxito] Catálogos cargados correctamente:', result);
  } catch (error) {
    console.error('[Fallo Crítico]: Error al cargar los catálogos.');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
