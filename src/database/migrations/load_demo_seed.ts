import { Pool } from 'pg';
import { pool } from '../../config/database';

export interface DemoSeedResult {
  usersInserted: number;
  profilesInserted: number;
  projectsInserted: number;
}

/**
 * Valida de forma estricta que el entorno sea seguro antes de permitir la carga de datos demo.
 * No confía únicamente en NODE_ENV: valida la cadena de conexión y exige confirmación explícita.
 */
export function assertSafeDemoEnvironment(
  customDatabaseUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  const isExplicitlyConfirmed =
    env.ALLOW_DEMO_SEED === 'true' || process.argv.includes('--confirm-demo');

  if (!isExplicitlyConfirmed) {
    throw new Error(
      'Carga de datos demo BLOQUEADA: Se requiere confirmación explícita mediante la variable de entorno ALLOW_DEMO_SEED=true o el argumento CLI --confirm-demo.'
    );
  }

  const dbUrl = customDatabaseUrl || env.DATABASE_URL || '';

  // Rechazar conexiones hacia proveedores en la nube conocidos o dominios de producción
  const isRemoteHost =
    /supabase\.co|onrender\.com|aws\.amazon|amazonaws\.com|pooler\.supabase|azure|gcp/i.test(
      dbUrl
    );

  const isProductionMode = env.NODE_ENV === 'production';

  if (isRemoteHost || isProductionMode) {
    throw new Error(
      'Carga de datos demo BLOQUEADA EN PRODUCCIÓN: Se detectó una base de datos remota o NODE_ENV=production. Los datos de demostración están restringidos a entornos de pruebas locales o desechables.'
    );
  }
}

/**
 * Carga de datos de demostración para entornos locales de desarrollo/pruebas.
 * - Requiere confirmación explícita y bloqueo en producción.
 * - NUNCA sobrescribe contraseñas, roles ni términos de usuarios existentes (ON CONFLICT DO NOTHING).
 * - No altera las cuentas administrativas reales existentes.
 */
export async function loadDemoSeed(customPool?: Pool): Promise<DemoSeedResult> {
  assertSafeDemoEnvironment();

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
