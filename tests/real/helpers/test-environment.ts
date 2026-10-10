import { execSync } from 'child_process';
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';

export const TEST_PG_PORT = 55432;
export const TEST_REDIS_PORT = 56379;

export const TEST_PG_CONTAINER = 'social_unsch_test_pg_etapa2';
export const TEST_REDIS_CONTAINER = 'social_unsch_test_redis_etapa2';

export const TEST_DATABASE_URL = `postgres://test_admin:test_secure_password_123@127.0.0.1:${TEST_PG_PORT}/social_unsch_test`;
export const TEST_REDIS_URL = `redis://127.0.0.1:${TEST_REDIS_PORT}`;

/**
 * Validador estricto para impedir que las pruebas reales se ejecuten
 * contra bases de datos remotas o de producción.
 */
export function assertSafeTestDatabase(url: string): void {
  const isLocalhost =
    url.includes('127.0.0.1') || url.includes('localhost');
  const isTestDb = url.includes('social_unsch_test') || url.includes(String(TEST_PG_PORT));
  const isRemote =
    /supabase\.co|onrender\.com|aws|amazonaws|azure|gcp|production/i.test(url);

  if (!isLocalhost || !isTestDb || isRemote) {
    throw new Error(
      `SEGURIDAD: La suite de pruebas reales rechazó la cadena de conexión '${url}'. Debe apuntar exclusivamente a la instancia local desechable en el puerto ${TEST_PG_PORT}.`
    );
  }
}

/**
 * Genera un par de llaves RSA de 2048 bits efímeras para pruebas reales de JWT sin secretos estáticos.
 */
export function generateEphemeralRsaKeys(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/**
 * Inicia los contenedores Docker aislados para PostgreSQL y Redis exclusivamente para las pruebas.
 * No detiene ni afecta contenedores ajenos ni proyectos paralelos.
 */
export async function startTestContainers(): Promise<void> {
  console.log('[TestEnv]: Iniciando contenedores desechables de prueba...');

  // Detener instancias previas huérfanas si quedaron registradas
  try {
    execSync(`docker rm -f ${TEST_PG_CONTAINER} ${TEST_REDIS_CONTAINER}`, { stdio: 'ignore' });
  } catch {}

  // Iniciar PostgreSQL de pruebas
  execSync(
    `docker run -d --name ${TEST_PG_CONTAINER} -p 127.0.0.1:${TEST_PG_PORT}:5432 ` +
      `-e POSTGRES_DB=social_unsch_test -e POSTGRES_USER=test_admin -e POSTGRES_PASSWORD=test_secure_password_123 ` +
      `postgres:15-alpine`,
    { stdio: 'ignore' }
  );

  // Iniciar Redis de pruebas
  execSync(
    `docker run -d --name ${TEST_REDIS_CONTAINER} -p 127.0.0.1:${TEST_REDIS_PORT}:6379 redis:7-alpine`,
    { stdio: 'ignore' }
  );

  // Esperar a que PostgreSQL esté listo para aceptar conexiones
  const maxAttempts = 30;
  let pgReady = false;
  for (let i = 0; i < maxAttempts; i++) {
    const testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
      connectionTimeoutMillis: 1000,
    });
    try {
      const client = await testPool.connect();
      await client.query('SELECT 1');
      client.release();
      await testPool.end();
      pgReady = true;
      break;
    } catch {
      await testPool.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!pgReady) {
    throw new Error('PostgreSQL de pruebas no respondió a tiempo.');
  }

  // Esperar a que Redis responda PONG
  let redisReady = false;
  for (let i = 0; i < maxAttempts; i++) {
    const testRedis = new Redis(TEST_REDIS_URL, { connectTimeout: 1000, lazyConnect: true });
    try {
      await testRedis.connect();
      const pong = await testRedis.ping();
      if (pong === 'PONG') {
        redisReady = true;
        await testRedis.quit();
        break;
      }
    } catch {
      testRedis.disconnect();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!redisReady) {
    throw new Error('Redis de pruebas no respondió a tiempo.');
  }

  // Configurar entorno de proceso para la suite
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = TEST_REDIS_URL;
  process.env.NODE_ENV = 'test';

  const { privateKey, publicKey } = generateEphemeralRsaKeys();
  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;

  console.log('[TestEnv]: ✔ Contenedores de prueba en línea y listos para ejecutar la suite.');
}

/**
 * Detiene y elimina EXCLUSIVAMENTE los contenedores temporales de prueba.
 * No altera ningún contenedor de otros proyectos.
 */
export async function stopTestContainers(): Promise<void> {
  console.log('[TestEnv]: Limpiando contenedores temporales de prueba...');
  try {
    execSync(`docker rm -f ${TEST_PG_CONTAINER} ${TEST_REDIS_CONTAINER}`, { stdio: 'ignore' });
    console.log('[TestEnv]: ✔ Contenedores de prueba limpiados correctamente.');
  } catch (err) {
    console.warn('[TestEnv]: Advertencia al limpiar contenedores de prueba:', (err as Error).message);
  }
}

/**
 * Retorna un Pool de conexiones configurado contra la base de datos de pruebas.
 */
export function getTestPool(): Pool {
  assertSafeTestDatabase(TEST_DATABASE_URL);
  return new Pool({
    connectionString: TEST_DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });
}

/**
 * Retorna un cliente ioredis conectado al Redis de pruebas.
 */
export function getTestRedis(): Redis {
  return new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: 3,
  });
}
