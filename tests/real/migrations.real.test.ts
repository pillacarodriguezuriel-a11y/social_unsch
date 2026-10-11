import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Pool } from 'pg';
import {
  getTestPool,
  TEST_DATABASE_URL,
} from './helpers/test-environment';
import { runMigrations, getMigrationStatus } from '../../src/database/migrations/migrator';
import { loadCatalogs } from '../../src/database/migrations/load_catalogs';
import { loadDemoSeed, assertSafeDemoEnvironment } from '../../src/database/migrations/load_demo_seed';

describe('Real Migrations & Catalogs Engine (PostgreSQL Real)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Limpiar esquema público de pruebas para aislamiento estricto entre pruebas
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  it('Scenario 1: Instalación limpia en una base vacía aplica todas las migraciones y registra schema_migrations', async () => {
    const res = await runMigrations(pool);

    expect(res.success).toBe(true);
    expect(res.applied.length).toBe(5);
    expect(res.skipped.length).toBe(0);

    // Verificar que la tabla de trazabilidad schema_migrations contenga las 5 migraciones
    const status = await getMigrationStatus(pool);
    expect(status.applied.length).toBe(5);
    expect(status.pending.length).toBe(0);

    // Verificar existencia de tablas críticas del sistema
    const tablesRes = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('faculties');
    expect(tableNames).toContain('professional_schools');
    expect(tableNames).toContain('feed_posts');
    expect(tableNames).toContain('matchmaking_projects');
    expect(tableNames).toContain('academic_files');
    expect(tableNames).toContain('carpooling_routes');
    expect(tableNames).toContain('campus_alerts');
  });

  it('Scenario 2: Segunda ejecución consecutiva es idempotente y no duplica ni modifica datos', async () => {
    // Primera ejecución
    await runMigrations(pool);
    await loadCatalogs(pool);

    // Conteo previo de tablas y registros
    const facultiesCountBefore = (await pool.query('SELECT COUNT(*) FROM faculties')).rows[0].count;
    const schoolsCountBefore = (await pool.query('SELECT COUNT(*) FROM professional_schools')).rows[0].count;

    // Segunda ejecución (idempotente)
    const secondMigrationRes = await runMigrations(pool);
    expect(secondMigrationRes.success).toBe(true);
    expect(secondMigrationRes.applied.length).toBe(0);
    expect(secondMigrationRes.skipped.length).toBe(5);

    const secondCatalogRes = await loadCatalogs(pool);
    expect(secondCatalogRes.facultiesInserted).toBe(0);
    expect(secondCatalogRes.facultiesPreserved).toBe(9);
    expect(secondCatalogRes.schoolsInserted).toBe(0);
    expect(secondCatalogRes.schoolsPreserved).toBe(31);

    const facultiesCountAfter = (await pool.query('SELECT COUNT(*) FROM faculties')).rows[0].count;
    const schoolsCountAfter = (await pool.query('SELECT COUNT(*) FROM professional_schools')).rows[0].count;

    expect(facultiesCountAfter).toBe(facultiesCountBefore);
    expect(schoolsCountAfter).toBe(schoolsCountBefore);
  });

  it('Scenario 3: Preservación de IDs, relaciones, contraseñas, roles y consentimientos existentes', async () => {
    await runMigrations(pool);
    await loadCatalogs(pool);

    // Insertar un usuario real existente con rol y datos canónicos
    const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id, has_accepted_terms)
       VALUES ($1, 'Usuario Existente Conservado', 'existente@unsch.edu.pe', '$2b$12$hash_secreto_existente', 'professor', 20, true)`,
      [userId]
    );

    // Insertar una publicación en el feed asociada a ese usuario y escuela
    await pool.query(
      `INSERT INTO feed_posts (user_id, professional_school_id, content)
       VALUES ($1, 20, 'Publicación previa que no debe perder su escuela')`,
      [userId]
    );

    // Re-ejecutar catálogos (simula despliegue o actualización de base existente)
    await loadCatalogs(pool);

    // Verificar que el usuario no fue modificado ni sus términos reseteados
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    expect(user.professional_school_id).toBe(20);
    expect(user.has_accepted_terms).toBe(true);
    expect(user.password_hash).toBe('$2b$12$hash_secreto_existente');
    expect(user.role).toBe('professor');

    // Verificar que la publicación de feed no fue puesta en NULL
    const postRes = await pool.query('SELECT professional_school_id FROM feed_posts WHERE user_id = $1', [userId]);
    expect(postRes.rows[0].professional_school_id).toBe(20);
  });

  it('Scenario 4: Ausencia total de cuentas demo tras la migración normal y catálogos', async () => {
    await runMigrations(pool);
    await loadCatalogs(pool);

    // Constatar que no existen usuarios demo insertados por omisión
    const usersRes = await pool.query('SELECT COUNT(*) FROM users');
    expect(Number(usersRes.rows[0].count)).toBe(0);

    const adminRes = await pool.query("SELECT * FROM users WHERE email = 'admin@unsch.edu.pe'");
    expect(adminRes.rows.length).toBe(0);
  });

  it('Scenario 5: Adopción de base de datos pre-Etapa 2 (esquema anterior sin schema_migrations con datos y relaciones)', async () => {
    // 1. Simular esquema previo a la Etapa 2 ejecutando base_schema.sql histórico
    const oldSqlPath = path.join(__dirname, '../../src/database/migrations/base_schema.sql');
    const oldSql = fs.readFileSync(oldSqlPath, 'utf8');
    await pool.query(oldSql);

    // Comprobar que schema_migrations NO existe en este estado
    const checkMigrationsTbl = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'"
    );
    expect(checkMigrationsTbl.rows.length).toBe(0);

    // 2. Insertar datos sintéticos previos y relaciones
    await pool.query(
      "INSERT INTO faculties (id, name, abbreviation) VALUES (1, 'Ciencias Agrarias', 'FCA')"
    );
    await pool.query(
      "INSERT INTO professional_schools (id, faculty_id, name, code) VALUES (1, 1, 'Agronomía', 'AGR')"
    );
    const legacyUserId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id, current_academic_cycle, credits_balance, has_accepted_terms)
       VALUES ($1, 'Estudiante Previo Adopcion', 'estudiante.previo@unsch.edu.pe', '$2b$12$hash_previo', 'student', 1, 6, 10, true)`,
      [legacyUserId]
    );
    await pool.query(
      `INSERT INTO feed_posts (user_id, professional_school_id, content)
       VALUES ($1, 1, 'Publicación creada antes de Etapa 2')`,
      [legacyUserId]
    );

    // 3. Ejecutar runMigrations sobre la base existente
    const res = await runMigrations(pool);
    expect(res.success).toBe(true);
    expect(res.applied.length).toBe(5);

    // 4. Verificar que schema_migrations fue creada y registró todas las versiones
    const status = await getMigrationStatus(pool);
    expect(status.applied.length).toBe(5);

    // 5. Verificar que los datos sintéticos previos y relaciones foráneas están intactos
    const userCheck = (await pool.query('SELECT * FROM users WHERE id = $1', [legacyUserId])).rows[0];
    expect(userCheck.full_name).toBe('Estudiante Previo Adopcion');
    expect(userCheck.credits_balance).toBe(10);
    expect(userCheck.has_accepted_terms).toBe(true);
    expect(userCheck.professional_school_id).toBe(1);

    const postCheck = (await pool.query('SELECT * FROM feed_posts WHERE user_id = $1', [legacyUserId])).rows[0];
    expect(postCheck.professional_school_id).toBe(1);
    expect(postCheck.content).toBe('Publicación creada antes de Etapa 2');
  });

  it('Scenario 6: Adopción de base parcialmente migrada, interrupción y posterior reanudación', async () => {
    // 1. Aplicar parcialmente hasta la migración 002
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL
      );
    `);

    const sql001 = fs.readFileSync(path.join(__dirname, '../../src/database/migrations/sql/001_base_schema.sql'), 'utf8');
    const sql002 = fs.readFileSync(path.join(__dirname, '../../src/database/migrations/sql/002_matchmaking.sql'), 'utf8');
    await pool.query(sql001);
    await pool.query("INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES ('001', '001_base_schema.sql', 'fake1', 10)");
    await pool.query(sql002);
    await pool.query("INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES ('002', '002_matchmaking.sql', 'fake2', 10)");

    // Estado intermedio: 2 aplicadas, 3 pendientes
    const midStatus = await getMigrationStatus(pool);
    expect(midStatus.applied.length).toBe(2);
    expect(midStatus.pending.length).toBe(3);

    // 2. Reanudar el proceso de migración: debe omitir 001 y 002 y aplicar 003, 004, 005
    const resumeRes = await runMigrations(pool);
    expect(resumeRes.success).toBe(true);
    expect(resumeRes.applied).toEqual([
      '003_credits_and_wiki.sql',
      '004_moderation_and_carpooling.sql',
      '005_canonical_extensions.sql',
    ]);
    expect(resumeRes.skipped).toEqual(['001_base_schema.sql', '002_matchmaking.sql']);

    const finalStatus = await getMigrationStatus(pool);
    expect(finalStatus.applied.length).toBe(5);
    expect(finalStatus.pending.length).toBe(0);
  });

  it('Scenario 7: Detección y diagnóstico de columnas incompatibles sin éxito falso ni borrado de datos', async () => {
    // Crear tabla users previa con tipo incompatible deliberado: credits_balance como VARCHAR en vez de INT
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TYPE user_role AS ENUM ('student', 'alumnus', 'professor', 'administrator');
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(200) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'student',
        credits_balance VARCHAR(50) NOT NULL DEFAULT 'diez_creditos', -- Incompatible!
        has_accepted_terms BOOLEAN NOT NULL DEFAULT false
      );
      INSERT INTO users (full_name, email, password_hash, credits_balance)
      VALUES ('Usuario Con Tipo Incompatible', 'incompatible@unsch.edu.pe', '$2b$12$hash', 'diez_creditos');
    `);

    // Intentar ejecutar migraciones: debe fallar con diagnóstico explícito
    await expect(runMigrations(pool)).rejects.toThrow(
      "[Incompatibilidad de Esquema en 001_base_schema.sql]: La columna 'users.credits_balance' tiene tipo incompatible 'character varying'"
    );

    // Garantía 1: NO se marcó éxito falso en schema_migrations
    const checkMigrations = await pool.query(
      "SELECT * FROM schema_migrations WHERE version = '001'"
    );
    expect(checkMigrations.rows.length).toBe(0);

    // Garantía 2: NO se borraron los datos existentes para resolver la incompatibilidad
    const checkUserData = await pool.query(
      "SELECT * FROM users WHERE email = 'incompatible@unsch.edu.pe'"
    );
    expect(checkUserData.rows.length).toBe(1);
    expect(checkUserData.rows[0].credits_balance).toBe('diez_creditos');
  });

  it('Scenario 8: Catálogos e identificadores con resolución de colisiones, nombres ambiguos y preservación de relaciones', async () => {
    await runMigrations(pool);

    // Simular base existente con desalineación de IDs y colisión:
    // En la base previa:
    // ID 5 = "Ingeniería en Sistemas" (código ambiguo/alias, canónico es ID 20)
    // ID 20 = "Educación Secundaria" (colisión! ocupa el 20, su canónico es ID 8)
    await pool.query("INSERT INTO faculties (id, name, abbreviation) VALUES (1, 'Facultad Temporal', 'FT')");
    await pool.query(`
      INSERT INTO professional_schools (id, faculty_id, name, code)
      VALUES 
        (5, 1, 'Ingeniería en Sistemas', 'ISI'),
        (20, 1, 'Educación Secundaria', 'EDS')
    `);

    // Asociar usuarios y publicaciones a los IDs antiguos
    const userSistemasId = '11111111-aaaa-bbbb-cccc-111111111111';
    const userEducacionId = '22222222-aaaa-bbbb-cccc-222222222222';
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id)
       VALUES 
        ($1, 'Estudiante Sistemas', 'sistemas@unsch.edu.pe', 'hash1', 'student', 5),
        ($2, 'Estudiante Educacion', 'educacion@unsch.edu.pe', 'hash2', 'student', 20)`,
      [userSistemasId, userEducacionId]
    );

    await pool.query(
      `INSERT INTO feed_posts (user_id, professional_school_id, content)
       VALUES ($1, 5, 'Post de sistemas con ID previo 5')`,
      [userSistemasId]
    );

    // Ejecutar sincronización de catálogos
    await loadCatalogs(pool);

    // Garantía 1: "Ingeniería de Sistemas" se re-alineó a su ID canónico 20
    const sistemasSchool = (
      await pool.query("SELECT id, name, code FROM professional_schools WHERE name = 'Ingeniería de Sistemas'")
    ).rows[0];
    expect(sistemasSchool.id).toBe(20);

    // Garantía 2: "Educación Secundaria" se re-alineó a su ID canónico 8 sin colisionar
    const educacionSchool = (
      await pool.query("SELECT id, name, code FROM professional_schools WHERE name = 'Educación Secundaria'")
    ).rows[0];
    expect(educacionSchool.id).toBe(8);

    // Garantía 3: El usuario de Sistemas se actualizó al ID 20 (preserva su escuela correcta en la UI)
    const checkUserSistemas = (await pool.query('SELECT professional_school_id FROM users WHERE id = $1', [userSistemasId])).rows[0];
    expect(checkUserSistemas.professional_school_id).toBe(20);

    // Garantía 4: El usuario de Educación se actualizó al ID 8 (evita que la UI lo asigne a Sistemas)
    const checkUserEducacion = (await pool.query('SELECT professional_school_id FROM users WHERE id = $1', [userEducacionId])).rows[0];
    expect(checkUserEducacion.professional_school_id).toBe(8);

    // Garantía 5: La publicación del feed se actualizó al ID 20 conservando su asociación
    const checkPost = (await pool.query('SELECT professional_school_id FROM feed_posts WHERE user_id = $1', [userSistemasId])).rows[0];
    expect(checkPost.professional_school_id).toBe(20);
  });

  it('Scenario 9: Bloqueo consultivo de sesión (pg_try_advisory_lock) impide dos ejecutores simultáneos en paralelo', async () => {
    // Disparar dos ejecutores simultáneos compitiendo por la misma base de datos
    const [run1, run2] = await Promise.allSettled([
      runMigrations(pool),
      runMigrations(pool),
    ]);

    const successes = [run1, run2].filter((r) => r.status === 'fulfilled');
    const failures = [run1, run2].filter((r) => r.status === 'rejected');

    // Exactamente uno debe adquirir el bloqueo y completar
    expect(successes.length).toBe(1);

    // El otro debe ser rechazado inmediatamente por el advisory lock
    expect(failures.length).toBe(1);
    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toContain('No se pudo adquirir el bloqueo de migración (pg_advisory_lock)');

    // Estado final: exactamente 5 migraciones aplicadas sin duplicados
    const status = await getMigrationStatus(pool);
    expect(status.applied.length).toBe(5);
  });

  it('Scenario 10: Validación positiva del seed de demostración (Allowlist) y conservación de usuarios existentes', async () => {
    await runMigrations(pool);
    await loadCatalogs(pool);

    // 1. Bloqueo sin confirmación
    expect(() => {
      assertSafeDemoEnvironment(TEST_DATABASE_URL, { ALLOW_DEMO_SEED: 'false' });
    }).toThrow('Carga de datos demo BLOQUEADA: Se requiere confirmación explícita');

    // 2. Bloqueo positivo ante host remoto / no permitido (incluso con confirmación)
    expect(() => {
      assertSafeDemoEnvironment('postgres://postgres:pass@db.xxxx.supabase.co:5432/postgres', {
        ALLOW_DEMO_SEED: 'true',
      });
    }).toThrow('no está en la lista positiva');

    expect(() => {
      assertSafeDemoEnvironment('postgres://postgres:pass@192.168.1.50:5432/social_unsch_dev', {
        ALLOW_DEMO_SEED: 'true',
      });
    }).toThrow('no está en la lista positiva');

    // 3. Bloqueo ante NODE_ENV=production incondicional
    expect(() => {
      assertSafeDemoEnvironment(TEST_DATABASE_URL, {
        ALLOW_DEMO_SEED: 'true',
        NODE_ENV: 'production',
      });
    }).toThrow('Carga de datos demo BLOQUEADA EN PRODUCCIÓN');

    // 4. Inserción de un usuario previo con el email que usa el seed demo
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, professional_school_id, has_accepted_terms)
       VALUES ('aaaaaaaa-1111-2222-3333-444444444444', 'Juan Preexistente', 'jquispe@unsch.edu.pe', '$2b$12$clave_previa_no_sobrescribir', 'student', 20, false)`
    );

    // Ejecutar seed demo en entorno local permitido
    process.env.ALLOW_DEMO_SEED = 'true';
    const seedRes = await loadDemoSeed(pool, TEST_DATABASE_URL);
    expect(seedRes.usersInserted).toBe(3); // 3 nuevos, 1 omitido por ON CONFLICT DO NOTHING
    delete process.env.ALLOW_DEMO_SEED;

    // Verificar que el usuario previo NO cambió su hash ni sus consentimientos
    const checkUser = (await pool.query("SELECT * FROM users WHERE email = 'jquispe@unsch.edu.pe'")).rows[0];
    expect(checkUser.password_hash).toBe('$2b$12$clave_previa_no_sobrescribir');
    expect(checkUser.has_accepted_terms).toBe(false);
  });

  it('Scenario 11: Ejecución del comando de migración como subproceso con fallo deliberado y salida no cero', async () => {
    // 1. Crear un script DDL con fallo sintáctico deliberado en sql/
    const sqlDir = path.join(__dirname, '../../src/database/migrations/sql');
    const failingMigrationPath = path.join(sqlDir, '999_deliberate_failure_test.sql');

    fs.writeFileSync(
      failingMigrationPath,
      'CREATE TABLE test_temp_should_rollback (id INT); SELECT THIS_IS_A_DELIBERATE_SYNTAX_ERROR;'
    );

    try {
      // 2. Ejecutar el comando de migración como subproceso
      const proc = spawnSync(
        'npx',
        ['ts-node', '--project', 'tsconfig.backend.json', 'src/database/migrations/run_migrate.ts'],
        {
          cwd: path.join(__dirname, '../..'),
          env: {
            ...process.env,
            DATABASE_URL: TEST_DATABASE_URL,
          },
          encoding: 'utf8',
          shell: true,
        }
      );

      // Garantía 1: Código de salida distinto de cero
      expect(proc.status).toBe(1);

      // Garantía 2: Ausencia de registro de éxito de la migración fallida en schema_migrations
      const statusRes = await pool.query(
        "SELECT * FROM schema_migrations WHERE version = '999'"
      );
      expect(statusRes.rows.length).toBe(0);

      // Garantía 3: La tabla creada antes del fallo fue revertida por ROLLBACK
      const checkTable = await pool.query(
        "SELECT to_regclass('public.test_temp_should_rollback') AS tbl"
      );
      expect(checkTable.rows[0].tbl).toBeNull();
    } finally {
      // Limpiar archivo temporal de prueba
      if (fs.existsSync(failingMigrationPath)) {
        fs.unlinkSync(failingMigrationPath);
      }
    }
  });
});
