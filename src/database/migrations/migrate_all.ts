import { execSync } from 'child_process';
import path from 'path';

/**
 * Orquestador principal de migraciones de base de datos para SOCIAL-UNSCH.
 * Ejecuta de forma secuencial y cronológica cada script de migración para evitar
 * fallos de integridad referencial y dependencias de tablas (código 42P01).
 */
function runMigrationStep(scriptPath: string) {
  const resolvedPath = path.resolve(scriptPath);
  const scriptName = path.basename(scriptPath);
  
  console.log(`\n[Orchestrator]: >>> Iniciando paso de migración: ${scriptName} ...`);
  try {
    execSync(`npx ts-node "${resolvedPath}"`, { stdio: 'inherit' });
    console.log(`[Orchestrator]: >>> Paso completado exitosamente: ${scriptName}\n`);
  } catch (error) {
    console.error(`[Orchestrator]: [Error] Fallo crítico al ejecutar el paso: ${scriptName}`);
    process.exit(1);
  }
}

async function runAll() {
  console.log('================================================================');
  console.log(' INICIANDO CICLO DE VIDA DE MIGRACIONES - SOCIAL-UNSCH');
  console.log('================================================================');

  // Paso 1: Sistema Base (Sprint 1)
  runMigrationStep('src/database/migrations/run_migration.ts');

  // Paso 2: Capa Económica (Sprint 4)
  runMigrationStep('src/database/migrations/run_credits_migration.ts');

  // Paso 3: Moderación y Carpooling (Sprint 5)
  runMigrationStep('src/database/migrations/run_moderation_migration.ts');

  // Paso 4: Carga de Datos Semilla (Catálogos y Datos Demo)
  runMigrationStep('src/database/migrations/run_seed.ts');

  // Paso 5: Migración de datos canónicos y alineación con la Skill
  runMigrationStep('src/database/migrations/run_canonical_migration.ts');

  console.log('================================================================');
  console.log(' [Éxito] ¡Base de datos completamente migrada y sembrada con éxito!');
  console.log('================================================================');
}

runAll();
