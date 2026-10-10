import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { pool } from '../../config/database';

export interface MigrationRecord {
  id: number;
  version: string;
  name: string;
  checksum: string;
  executed_at: Date;
  execution_time_ms: number;
}

export interface MigrationResult {
  success: boolean;
  applied: string[];
  skipped: string[];
  totalAvailable: number;
  error?: Error;
}

const ADVISORY_LOCK_ID = 948201;

/**
 * Calcula el hash SHA-256 de una cadena SQL para registrar trazabilidad e integridad.
 */
export function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Garantiza que la tabla de trazabilidad schema_migrations exista.
 */
export async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL
    );
  `);
}

/**
 * Intenta adquirir un bloqueo de aviso exclusivo a nivel de sesión PostgreSQL.
 * Previene ejecuciones simultáneas incompatibles sobre la base de datos.
 */
export async function acquireAdvisoryLock(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ lock: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS lock',
    [ADVISORY_LOCK_ID]
  );
  return result.rows[0]?.lock === true;
}

/**
 * Libera el bloqueo de aviso exclusivo.
 */
export async function releaseAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {});
}

/**
 * Motor central de migraciones de DDL/Esquema.
 * Ejecuta únicamente archivos de evolución de esquema registrados en 'sql/'.
 * NO inserta datos de demostración ni ejecuta operaciones destructivas.
 */
export async function runMigrations(customPool?: Pool): Promise<MigrationResult> {
  const activePool = customPool || pool;
  const client = await activePool.connect();

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    const hasLock = await acquireAdvisoryLock(client);
    if (!hasLock) {
      throw new Error(
        'No se pudo adquirir el bloqueo de migración (pg_advisory_lock). Otro proceso de migración se encuentra en ejecución.'
      );
    }

    await ensureMigrationTable(client);

    // Obtener historial de migraciones aplicadas
    const historyRes = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY id ASC'
    );
    const appliedVersions = new Set(historyRes.rows.map((r) => r.version));

    // Directorio de scripts DDL ordenados
    const sqlDir = path.join(__dirname, 'sql');
    if (!fs.existsSync(sqlDir)) {
      throw new Error(`Directorio de migraciones SQL no encontrado: ${sqlDir}`);
    }

    const files = fs
      .readdirSync(sqlDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.split('_')[0];
      const filePath = path.join(sqlDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(sqlContent);

      if (appliedVersions.has(version)) {
        skipped.push(file);
        continue;
      }

      console.log(`[Migrator]: Aplicando migración de esquema: ${file} ...`);
      const startTime = Date.now();

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);

        const duration = Date.now() - startTime;
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
           VALUES ($1, $2, $3, $4)`,
          [version, file, checksum, duration]
        );

        await client.query('COMMIT');
        applied.push(file);
        console.log(`[Migrator]: ✔ Completado: ${file} (${duration} ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrator]: ✘ Fallo en la migración ${file}:`, (err as Error).message);
        throw err;
      }
    }

    return {
      success: true,
      applied,
      skipped,
      totalAvailable: files.length,
    };
  } finally {
    await releaseAdvisoryLock(client);
    client.release();
  }
}

/**
 * Consulta el estado actual de las migraciones sin alterar la base de datos.
 */
export async function getMigrationStatus(customPool?: Pool): Promise<{
  applied: MigrationRecord[];
  pending: string[];
}> {
  const activePool = customPool || pool;
  const client = await activePool.connect();

  try {
    await ensureMigrationTable(client);

    const historyRes = await client.query<MigrationRecord>(
      'SELECT id, version, name, checksum, executed_at, execution_time_ms FROM schema_migrations ORDER BY id ASC'
    );

    const appliedVersions = new Set(historyRes.rows.map((r) => r.version));
    const sqlDir = path.join(__dirname, 'sql');
    const files = fs.existsSync(sqlDir)
      ? fs.readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort()
      : [];

    const pending = files.filter((f) => !appliedVersions.has(f.split('_')[0]));

    return {
      applied: historyRes.rows,
      pending,
    };
  } finally {
    client.release();
  }
}
