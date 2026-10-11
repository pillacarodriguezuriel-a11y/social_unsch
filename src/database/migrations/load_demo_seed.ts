import { Pool } from 'pg';
import { pool } from '../../config/database';

export interface DemoSeedResult {
  usersInserted: number;
  profilesInserted: number;
  projectsInserted: number;
}

const ALLOWED_LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
]);

const ALLOWED_LOCAL_DATABASES = new Set([
  'social_unsch',
  'social_unsch_dev',
  'social_unsch_test',
]);

/**
 * Valida de forma estricta que el entorno sea un destino local de desarrollo/pruebas permitido
 * mediante VALIDACIÓN POSITIVA (Allowlist).
 *
 * Garantías:
 * - NODE_ENV=production siempre bloquea.
 * - La confirmación explícita por sí sola no habilita un destino remoto.
 * - Exige un destino local de desarrollo/pruebas identificado de forma explícita.
 * - Rechaza destinos desconocidos o remotos.
 * - Se ejecuta antes de abrir conexiones o escribir.
 */
export function assertSafeDemoEnvironment(
  customDatabaseUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  // 1. NODE_ENV=production siempre bloquea de forma incondicional
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Carga de datos demo BLOQUEADA EN PRODUCCIÓN: NODE_ENV está configurado como production. Los datos de demostración están terminantemente prohibidos en producción.'
    );
  }

  // 2. La confirmación explícita es requisito obligatorio, pero por sí sola NO habilita destinos remotos
  const isExplicitlyConfirmed =
    env.ALLOW_DEMO_SEED === 'true' || process.argv.includes('--confirm-demo');

  if (!isExplicitlyConfirmed) {
    throw new Error(
      'Carga de datos demo BLOQUEADA: Se requiere confirmación explícita mediante la variable de entorno ALLOW_DEMO_SEED=true o el argumento CLI --confirm-demo.'
    );
  }

  const dbUrl = customDatabaseUrl || env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('Carga de datos demo BLOQUEADA: No se especificó DATABASE_URL para validación.');
  }

  let hostname = '';
  let dbName = '';

  try {
    const parsed = new URL(dbUrl);
    hostname = parsed.hostname.toLowerCase();
    dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  } catch {
    const hostMatch = dbUrl.match(/@([^:/]+)/);
    hostname = hostMatch ? hostMatch[1].toLowerCase() : '';
    const dbMatch = dbUrl.match(/\/([^/?]+)(?:\?.*)?$/);
    dbName = dbMatch ? dbMatch[1].toLowerCase() : '';
  }

  // 3. Validación POSITIVA del host permitido
  if (!hostname || !ALLOWED_LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Carga de datos demo BLOQUEADA: El destino '${hostname || 'desconocido'}' no está en la lista positiva de destinos locales permitidos ([${Array.from(ALLOWED_LOCAL_HOSTS).join(', ')}]). La confirmación explícita por sí sola no habilita un destino remoto.`
    );
  }

  // 4. Validación POSITIVA de la base de datos permitida
  if (
    !ALLOWED_LOCAL_DATABASES.has(dbName) &&
    !dbName.includes('test') &&
    !dbName.includes('dev')
  ) {
    throw new Error(
      `Carga de datos demo BLOQUEADA: La base de datos '${dbName}' no es un destino local de desarrollo o pruebas identificado de forma explícita.`
    );
  }
}

/**
 * Carga de datos de demostración para entornos locales de desarrollo/pruebas.
 * - Ejecuta la validación positiva antes de abrir conexiones o escribir.
 * - Requiere confirmación explícita y bloqueo en producción.
 * - NUNCA sobrescribe contraseñas, roles ni términos de usuarios existentes (ON CONFLICT DO NOTHING).
 * - No altera las cuentas administrativas reales existentes.
 */
export async function loadDemoSeed(customPool?: Pool, customDbUrl?: string): Promise<DemoSeedResult> {
  const dbUrlToValidate =
    customDbUrl || (customPool as any)?.options?.connectionString || process.env.DATABASE_URL;
  // Validación positiva ejecutada ANTES de abrir conexiones
  assertSafeDemoEnvironment(dbUrlToValidate);

  const activePool = customPool || pool;
  const client = await activePool.connect();

  let usersInserted = 0;
  let profilesInserted = 0;
  let projectsInserted = 0;

  try {
    await client.query('BEGIN');
    console.log('[DemoSeed]: Ejecutando inserción segura de datos de demostración...');

    // Hash bcrypt de 'password123' (12 salt rounds) reservado estrictamente para pruebas locales
    const DUMMY_DEV_PASSWORD_HASH =
      '$2b$12$PXj9/5rZmC5QVuj5bL6fIebntgivHZiDz7ZFk0OIH7tazIC.2Ace6';

    // 1. Usuarios demo con ON CONFLICT DO NOTHING (no sobrescribe cuentas existentes)
    const demoUsers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        full_name: 'Juan Carlos Quispe',
        email: 'jquispe@unsch.edu.pe',
        role: 'student',
        school_id: 20, // Ing. de Sistemas
        cycle: 3,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        full_name: 'Ana María Huamán',
        email: 'ahuaman@unsch.edu.pe',
        role: 'student',
        school_id: 20, // Ing. de Sistemas
        cycle: 5,
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        full_name: 'Carlos Mendoza',
        email: 'cmendoza@unsch.edu.pe',
        role: 'student',
        school_id: 21, // Ing. Civil
        cycle: 5,
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        full_name: 'Administrador Demo',
        email: 'admin.demo@unsch.edu.pe',
        role: 'administrator',
        school_id: 20,
        cycle: 10,
      },
    ];

    for (const u of demoUsers) {
      const res = await client.query(
        `INSERT INTO users (
           id, full_name, email, password_hash, role,
           professional_school_id, current_academic_cycle, academic_cycle,
           credits_balance, has_accepted_terms
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5, true)
         ON CONFLICT (email) DO NOTHING`,
        [u.id, u.full_name, u.email, DUMMY_DEV_PASSWORD_HASH, u.role, u.school_id, u.cycle, u.cycle]
      );
      if ((res.rowCount ?? 0) > 0) {
        usersInserted++;
      }
    }

    // 2. Perfiles demo de Matchmaking
    const profiles = [
      {
        id: '55555555-5555-5555-5555-555555555555',
        user_id: '22222222-2222-2222-2222-222222222222',
        project_type: 'undergraduate_thesis',
        description: 'Buscando programador front-end en React para culminar tesis sobre redes comunitarias.',
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        user_id: '33333333-3333-3333-3333-333333333333',
        project_type: 'startup',
        description: 'Desarrollando app de reparto local en Ayacucho. Requiero apoyo en PostgreSQL.',
      },
    ];

    for (const p of profiles) {
      const res = await client.query(
        `INSERT INTO matchmaking_profiles (id, user_id, project_type, description, is_visible)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id) DO NOTHING`,
        [p.id, p.user_id, p.project_type, p.description]
      );
      if ((res.rowCount ?? 0) > 0) {
        profilesInserted++;
      }
    }

    // 3. Proyectos demo de Matchmaking
    const projects = [
      {
        id: '77777777-7777-7777-7777-777777777777',
        owner_id: '22222222-2222-2222-2222-222222222222',
        faculty_id: 7,
        title: 'Tesis Redes Comunitarias',
        description: 'Investigación sobre enrutamiento inalámbrico en zonas rurales.',
        project_type: 'undergraduate_thesis',
        skills_offered: ['Investigación', 'Normas APA', 'Redes'],
        skills_needed: ['Python', 'SQL', 'React'],
      },
      {
        id: '88888888-8888-8888-8888-888888888888',
        owner_id: '33333333-3333-3333-3333-333333333333',
        faculty_id: 7,
        title: 'Delivery Ayacucho Startup',
        description: 'Emprendimiento para digitalizar bodegas locales.',
        project_type: 'startup',
        skills_offered: ['Modelado de Datos', 'Finanzas'],
        skills_needed: ['TypeScript', 'React Native', 'SQL'],
      },
    ];

    for (const pr of projects) {
      const res = await client.query(
        `INSERT INTO matchmaking_projects (
           id, owner_id, faculty_id, title, description,
           project_type, skills_offered, skills_needed, max_members, current_members, is_open
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 3, 1, true)
         ON CONFLICT (id) DO NOTHING`,
        [
          pr.id,
          pr.owner_id,
          pr.faculty_id,
          pr.title,
          pr.description,
          pr.project_type,
          pr.skills_offered,
          pr.skills_needed,
        ]
      );
      if ((res.rowCount ?? 0) > 0) {
        projectsInserted++;
      }
    }

    await client.query('COMMIT');
    console.log(
      `[DemoSeed]: ✔ Datos demo insertados con éxito (Usuarios: ${usersInserted}, Perfiles: ${profilesInserted}, Proyectos: ${projectsInserted}).`
    );

    return { usersInserted, profilesInserted, projectsInserted };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DemoSeed]: ✘ Error al insertar datos demo:', (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}
