// Diagnóstico de solo lectura: ejecuta SELECT 1 en PostgreSQL y PING en Redis.
// No crea, modifica ni elimina datos. Nunca imprime usuarios, contraseñas ni URLs completas.
//
// Uso:  node scripts/diagnostico-conexiones.js
// Lee DATABASE_URL y REDIS_URL del entorno (o de .env si no están definidas).
// Código de salida: 0 si todas las conexiones configuradas responden, 1 en caso contrario.
require('dotenv').config();
const { Client } = require('pg');
const Redis = require('ioredis');

const TIMEOUT_MS = 8000;

function describe(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.hostname}:${u.port || '(por defecto)'}`;
  } catch {
    return '(URL no interpretable)';
  }
}

async function checkPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) return { name: 'PostgreSQL', ok: false, detail: 'DATABASE_URL no definida' };
  const client = new Client({ connectionString: url, connectionTimeoutMillis: TIMEOUT_MS });
  const started = Date.now();
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT 1 AS ok, current_setting('server_version') AS version, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls"
    );
    return {
      name: 'PostgreSQL',
      ok: rows[0].ok === 1,
      detail: `${describe(url)} version=${rows[0].version} tls=${rows[0].tls} ${Date.now() - started}ms`,
    };
  } catch (err) {
    return { name: 'PostgreSQL', ok: false, detail: `${describe(url)} ${err.code || ''} ${err.message}` };
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return { name: 'Redis', ok: false, detail: 'REDIS_URL no definida (la app usaría redis://127.0.0.1:6379)' };
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: TIMEOUT_MS,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  const started = Date.now();
  try {
    await redis.connect();
    const pong = await redis.ping();
    return {
      name: 'Redis',
      ok: pong === 'PONG',
      detail: `${describe(url)} tls=${url.startsWith('rediss://')} ${Date.now() - started}ms`,
    };
  } catch (err) {
    return { name: 'Redis', ok: false, detail: `${describe(url)} ${err.code || ''} ${err.message}` };
  } finally {
    redis.disconnect();
  }
}

(async () => {
  const results = [await checkPostgres(), await checkRedis()];
  for (const r of results) {
    console.log(`[${r.ok ? 'OK' : 'FALLO'}] ${r.name}: ${r.detail}`);
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
