import { runMigrations } from './migrator';
import { loadCatalogs } from './load_catalogs';
import { pool } from '../../config/database';

/**
 * Orquestador principal de migraciones para SOCIAL-UNSCH (Etapa 2).
 * Ejecuta en orden:
 * 1. Evolución del esquema DDL (migrator.ts -> sql/*.sql) con control transaccional y schema_migrations.
 * 2. Carga segura y no destructiva de catálogos operativos (facultades, escuelas, pabellones).
 *
 * NOTA DE SEGURIDAD:
 * Los datos de demostración (demo seeds) han sido desacoplados y NO se ejecutan aquí.
 * Para cargar datos demo en desarrollo local, ejecute: npm run db:seed:demo -- --confirm-demo.
 */
async function runAll(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO CICLO DE VIDA DE MIGRACIONES - SOCIAL-UNSCH');
  console.log('================================================================');

  try {
    // Paso 1: Evolución del Esquema DDL
    console.log('\n[Orchestrator]: >>> Paso 1: Ejecutando migraciones de esquema...');
    const migrationResult = await runMigrations();
    console.log(
      `[Orchestrator]: >>> Paso 1 completado. Aplicadas: ${migrationResult.applied.length}, Omitidas: ${migrationResult.skipped.length}.\n`
    );

    // Paso 2: Sincronización No Destructiva de Catálogos
    console.log('[Orchestrator]: >>> Paso 2: Sincronizando catálogos canónicos...');
    const catalogResult = await loadCatalogs();
    console.log(
      `[Orchestrator]: >>> Paso 2 completado exitosamente.\n`
    );

    console.log('================================================================');
    console.log(' [Éxito] ¡Base de datos migrada y catálogos sincronizados con éxito!');
    console.log('================================================================');
  } catch (error) {
    console.error(
      '\n[Orchestrator]: [Error] Fallo crítico durante el proceso de migración:',
      (error as Error).message
    );
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

runAll();
