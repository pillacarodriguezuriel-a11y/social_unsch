import { getMigrationStatus } from './migrator';
import { pool } from '../../config/database';

async function main() {
  console.log('=== SOCIAL-UNSCH: ESTADO DE MIGRACIONES DE BASE DE DATOS ===');
  try {
    const status = await getMigrationStatus();
    console.log(`\nMigraciones aplicadas (${status.applied.length}):`);
    if (status.applied.length === 0) {
      console.log('  (Ninguna migración registrada en schema_migrations)');
    } else {
      for (const m of status.applied) {
        console.log(`  ✔ [${m.version}] ${m.name} (${m.executed_at.toISOString()}, ${m.execution_time_ms}ms)`);
      }
    }

    console.log(`\nMigraciones pendientes (${status.pending.length}):`);
    if (status.pending.length === 0) {
      console.log('  (Al día: no hay migraciones pendientes)');
    } else {
      for (const p of status.pending) {
        console.log(`  ⏳ [Pendiente] ${p}`);
      }
    }
  } catch (error) {
    console.error('[Error]: No se pudo consultar el estado de migraciones:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
