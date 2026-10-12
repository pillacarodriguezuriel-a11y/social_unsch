import { runMigrations } from './migrator';
import { pool } from '../../config/database';

async function main() {
  console.log('=== SOCIAL-UNSCH: EJECUTANDO MIGRACIONES DE ESQUEMA (DDL) ===');
  try {
    const result = await runMigrations();
    console.log(
      `[Éxito] Migraciones finalizadas. Aplicadas: ${result.applied.length}, Omitidas (ya aplicadas): ${result.skipped.length}.`
    );
  } catch (error) {
    console.error('[Fallo Crítico]: La ejecución de migraciones no pudo completarse.');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
