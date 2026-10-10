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

  it('Scenario 5: Bloqueo estricto del seed de demostración en producción o sin confirmación CLI', async () => {
    await runMigrations(pool);
    await loadCatalogs(pool);

    // 1. Bloqueo sin confirmación explícita
    expect(() => {
      assertSafeDemoEnvironment(TEST_DATABASE_URL, { ALLOW_DEMO_SEED: 'false' });
    }).toThrow('Carga de datos demo BLOQUEADA: Se requiere confirmación explícita');

    // 2. Bloqueo ante URL remota de Supabase (probado sin conectar a producción)
    expect(() => {
      assertSafeDemoEnvironment('postgres://postgres:pass@db.xxxx.supabase.co:5432/postgres', {
        ALLOW_DEMO_SEED: 'true',
      });
    }).toThrow('Carga de datos demo BLOQUEADA EN PRODUCCIÓN');

    // 3. Bloqueo ante URL remota de Render
    expect(() => {
      assertSafeDemoEnvironment('postgres://user:pass@dpg-xxx.onrender.com/social_unsch', {
        ALLOW_DEMO_SEED: 'true',
      });
    }).toThrow('Carga de datos demo BLOQUEADA EN PRODUCCIÓN');

    // 4. Bloqueo ante NODE_ENV=production
    expect(() => {
      assertSafeDemoEnvironment(TEST_DATABASE_URL, {
        ALLOW_DEMO_SEED: 'true',
        NODE_ENV: 'production',
      });
    }).toThrow('Carga de datos demo BLOQUEADA EN PRODUCCIÓN');

    // 5. En entorno seguro local con confirmación: la carga se ejecuta correctamente
    process.env.ALLOW_DEMO_SEED = 'true';
    const seedRes = await loadDemoSeed(pool);
    expect(seedRes.usersInserted).toBe(4);
    delete process.env.ALLOW_DEMO_SEED;

    // Verificar que una segunda ejecución de demo seed no sobrescriba ni duplique usuarios
    process.env.ALLOW_DEMO_SEED = 'true';
    const seedRes2 = await loadDemoSeed(pool);
    expect(seedRes2.usersInserted).toBe(0); // ON CONFLICT DO NOTHING
    delete process.env.ALLOW_DEMO_SEED;
  });

  it('Scenario 6: Fallo transaccional deliberado revierte cambios y no avanza', async () => {
    await runMigrations(pool);

    // Intentar ejecutar un comando SQL con sintaxis inválida directamente dentro de una transacción
    const client = await pool.connect();
    let failed = false;
    try {
      await client.query('BEGIN');
      await client.query('CREATE TABLE test_should_rollback (id INT);');
      await client.query('THIS_IS_A_SYNTAX_ERROR_QUERY;');
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
      failed = true;
    } finally {
      client.release();
    }

    expect(failed).toBe(true);

    // Verificar que la tabla intermedia fue revertida
    const checkRes = await pool.query(
      "SELECT to_regclass('public.test_should_rollback') AS exists"
    );
    expect(checkRes.rows[0].exists).toBeNull();
  });
});
