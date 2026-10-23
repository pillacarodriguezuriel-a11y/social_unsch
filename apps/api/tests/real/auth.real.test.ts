import request from 'supertest';
import { Pool } from 'pg';
import { getTestPool } from './helpers/test-environment';
import { runMigrations } from '../../src/database/migrations/migrator';
import { loadCatalogs } from '../../src/database/migrations/load_catalogs';
import { createTestApp } from '../helpers/test-app';

const app = createTestApp();

describe('Real Authentication & Role Authorization (PostgreSQL Real)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);
    await loadCatalogs(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('Scenario 1: Registro permitido de estudiante con persistencia real en PostgreSQL y login exitoso', async () => {
    const registerBody = {
      full_name: 'Estudiante Real Test',
      email: 'estudiante.real@unsch.edu.pe',
      password: 'Password123#',
      role: 'student',
      professional_school_id: 20, // Ing. Sistemas
      current_academic_cycle: 4,
    };

    // 1. Registro por HTTP
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(registerBody)
      .set('Content-Type', 'application/json');

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.user_id).toBeDefined();

    // 2. Comprobar directamente en PostgreSQL que el usuario existe y su contraseña está hasheada
    const dbUserRes = await pool.query(
      'SELECT id, email, role, password_hash, credits_balance, has_accepted_terms FROM users WHERE email = $1',
      [registerBody.email]
    );
    expect(dbUserRes.rows.length).toBe(1);
    const dbUser = dbUserRes.rows[0];
    expect(dbUser.role).toBe('student');
    expect(dbUser.password_hash.startsWith('$2b$12$')).toBe(true);
    expect(dbUser.has_accepted_terms).toBe(false);

    // 3. Inicio de sesión real contra el hash almacenado
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: registerBody.email,
        password: 'Password123#',
      })
      .set('Content-Type', 'application/json');

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.access_token).toBeDefined();
    expect(loginRes.body.user.email).toBe(registerBody.email);
    expect(loginRes.body.user.role).toBe('student');

    // 4. Acceso con token válido a ruta protegida /api/v1/auth/profile-me
    const profileRes = await request(app)
      .get('/api/v1/auth/profile-me')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.user_id).toBe(regRes.body.user_id);
    expect(profileRes.body.user.role).toBe('student');
  });

  it('Scenario 2: Rechazo expreso del rol "administrator" sin persistencia de cuenta privilegiada', async () => {
    const maliciousAdminBody = {
      full_name: 'Intruso Auto Admin',
      email: 'intruso.admin@unsch.edu.pe',
      password: 'Password123#',
      role: 'administrator',
      professional_school_id: 20,
    };

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(maliciousAdminBody)
      .set('Content-Type', 'application/json');

    // Debe ser rechazado con 400 por validación
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Los roles administrativos no pueden ser autoasignados');

    // Verificar en PostgreSQL que el usuario NUNCA fue insertado
    const checkDb = await pool.query('SELECT * FROM users WHERE email = $1', [maliciousAdminBody.email]);
    expect(checkDb.rows.length).toBe(0);
  });

  it('Scenario 3: Rechazo de roles desconocidos (e.g. superadmin)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        full_name: 'Usuario Invalido',
        email: 'invalido@unsch.edu.pe',
        password: 'Password123#',
        role: 'superadmin',
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);

    const checkDb = await pool.query('SELECT * FROM users WHERE email = $1', ['invalido@unsch.edu.pe']);
    expect(checkDb.rows.length).toBe(0);
  });

  it('Scenario 4: Credenciales inválidas devuelven 401 sin revelar existencia de cuenta', async () => {
    // 1. Usuario inexistente
    const resNonExistent = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nadie.existe@unsch.edu.pe',
        password: 'Password123#',
      });
    expect(resNonExistent.status).toBe(401);
    expect(resNonExistent.body.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');

    // 2. Contraseña incorrecta para usuario existente
    const resWrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'estudiante.real@unsch.edu.pe',
        password: 'PasswordIncorrecta999#',
      });
    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
  });

  it('Scenario 5: Rutas protegidas rechazan peticiones sin token o con token alterado', async () => {
    // 1. Sin cabecera Authorization
    const resNoAuth = await request(app).get('/api/v1/auth/profile-me');
    expect(resNoAuth.status).toBe(401);
    expect(resNoAuth.body.code).toBe('ERR_AUTH_TOKEN_MISSING');

    // 2. Token con firma inválida / alterado
    const resTampered = await request(app)
      .get('/api/v1/auth/profile-me')
      .set('Authorization', 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.token_falsificado');
    expect(resTampered.status).toBe(401);
    expect(resTampered.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
  });
});
