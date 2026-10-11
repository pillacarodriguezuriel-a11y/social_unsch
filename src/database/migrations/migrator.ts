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
 * REQUISITOS DE CONEXIÓN PARA MIGRACIONES (UNSCH Architecture Decision):
 * - Las migraciones utilizan bloqueos consultivos de sesión (pg_try_advisory_lock).
 * - NO se debe ejecutar este migrador mediante connection poolers en modo transacción
 *   (e.g., PgBouncer en modo transaction o Supabase Transaction Pooler en puerto 6543),
 *   dado que los poolers de transacción no preservan la sesión física entre transacciones consecutivas.
 * - Se REQUIERE una conexión directa a PostgreSQL (Session Mode, puerto estándar 5432).
 */

/**
 * Valida la existencia y conformidad de tablas, columnas, tipos, restricciones,
 * índices y funciones relevantes tras aplicar una migración DDL.
 * Garantía: 'CREATE TABLE IF NOT EXISTS' no demuestra que una tabla tenga la estructura esperada.
 * Ante cualquier incompatibilidad emite un diagnóstico claro y lanza error para abortar con ROLLBACK.
 */
export async function validateMigrationStructure(
  client: PoolClient,
  version: string,
  fileName: string
): Promise<void> {
  if (version === '001') {
    // 1. Tablas requeridas
    const requiredTables = ['faculties', 'professional_schools', 'campus_pavilions', 'users', 'feed_posts'];
    for (const tbl of requiredTables) {
      const res = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tbl]
      );
      if (res.rows.length === 0) {
        throw new Error(
          `[Incompatibilidad de Esquema en ${fileName}]: Falta la tabla crítica '${tbl}'.`
        );
      }
    }

    // 2. Columnas y tipos en users
    const expectedUserCols: Record<string, string[]> = {
      id: ['uuid'],
      email: ['character varying', 'text'],
      role: ['USER-DEFINED'],
      credits_balance: ['integer'],
      has_accepted_terms: ['boolean'],
    };

    const colsRes = await client.query<{ column_name: string; data_type: string }>(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'"
    );
    const colsMap = new Map(colsRes.rows.map((r) => [r.column_name, r.data_type]));

    for (const [colName, expectedTypes] of Object.entries(expectedUserCols)) {
      if (!colsMap.has(colName)) {
        throw new Error(
          `[Incompatibilidad de Esquema en ${fileName}]: Falta la columna requerida 'users.${colName}'.`
        );
      }
      const actualType = colsMap.get(colName)!;
      if (!expectedTypes.includes(actualType)) {
        throw new Error(
          `[Incompatibilidad de Esquema en ${fileName}]: La columna 'users.${colName}' tiene tipo incompatible '${actualType}' (se esperaba: ${expectedTypes.join(', ')}).`
        );
      }
    }

    // 3. Enum user_role
    const enumRes = await client.query("SELECT 1 FROM pg_type WHERE typname = 'user_role'");
    if (enumRes.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta el tipo ENUM 'user_role'.`);
    }

    // 4. Índice en users(email)
    const emailIdx = await client.query(
      "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'users' AND indexdef ILIKE '%email%'"
    );
    if (emailIdx.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta el índice de búsqueda en 'users(email)'.`);
    }
  }

  if (version === '002') {
    const requiredTables = ['matchmaking_projects', 'matchmaking_profiles', 'matchmaking_interactions'];
    for (const tbl of requiredTables) {
      const res = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tbl]
      );
      if (res.rows.length === 0) {
        throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la tabla crítica '${tbl}'.`);
      }
    }
  }

  if (version === '003') {
    const requiredTables = ['academic_files', 'file_downloads', 'wiki_credits_log'];
    for (const tbl of requiredTables) {
      const res = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tbl]
      );
      if (res.rows.length === 0) {
        throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la tabla crítica '${tbl}'.`);
      }
    }

    // Función y trigger de descarga de archivos y débito/crédito
    const fnRes = await client.query("SELECT 1 FROM pg_proc WHERE proname = 'fn_process_file_download'");
    if (fnRes.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la función 'fn_process_file_download()'.`);
    }
    const trgRes = await client.query("SELECT 1 FROM pg_trigger WHERE tgname = 'trg_process_file_download'");
    if (trgRes.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta el trigger 'trg_process_file_download'.`);
    }
  }

  if (version === '004') {
    const requiredTables = ['moderation_reports', 'moderation_audit_log', 'carpooling_routes', 'carpooling_requests'];
    for (const tbl of requiredTables) {
      const res = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tbl]
      );
      if (res.rows.length === 0) {
        throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la tabla crítica '${tbl}'.`);
      }
    }

    // Columnas añadidas a users
    const colsRes = await client.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'"
    );
    const cols = new Set(colsRes.rows.map((r) => r.column_name));
    if (!cols.has('academic_cycle') || !cols.has('phone_number') || !cols.has('whatsapp_link')) {
      throw new Error(
        `[Incompatibilidad de Esquema en ${fileName}]: Faltan columnas añadidas en 'users' (academic_cycle, phone_number o whatsapp_link).`
      );
    }

    const fnRes = await client.query("SELECT 1 FROM pg_proc WHERE proname = 'fn_auto_suppress_reported_post'");
    if (fnRes.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la función 'fn_auto_suppress_reported_post()'.`);
    }
  }

  if (version === '005') {
    const res = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campus_alerts'"
    );
    if (res.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta la tabla crítica 'campus_alerts'.`);
    }

    const enumRes = await client.query("SELECT 1 FROM pg_type WHERE typname = 'campus_alert_type'");
    if (enumRes.rows.length === 0) {
      throw new Error(`[Incompatibilidad de Esquema en ${fileName}]: Falta el tipo ENUM 'campus_alert_type'.`);
    }
  }
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

        // Verificación estructural estricta antes de registrar éxito
        await validateMigrationStructure(client, version, file);

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
    try {
      await releaseAdvisoryLock(client);
    } catch (lockErr) {
      console.warn('[Migrator]: Advertencia al liberar advisory lock:', lockErr);
    } finally {
      client.release();
    }
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
