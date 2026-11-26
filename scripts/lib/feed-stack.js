'use strict';
/**
 * Infraestructura real y desechable para las pruebas E2E de Feed.
 *
 * Reutiliza las utilidades de radar-stack (Infra, generateKeys, AppProcess, etc.) y agrega:
 *   - feedProcess(): proceso compilado de apps/feed
 *   - apiProcess() extendido con soporte para FEED_MODE y FEED_PROXY_TARGET
 *
 * Solo se levanta PostgreSQL (el servicio Feed no necesita Redis).
 */

const path = require('path');
const { ROOT, Infra, AppProcess, radarProcess, blackHoleServer, generateKeys, assertLocalUrl, waitFor, sleep, tcpOpen } = require('./radar-stack');

const FEED_DIR = path.join(ROOT, 'apps', 'feed');
const API_DIR = path.join(ROOT, 'apps', 'api');

/** Entorno base: nada se hereda de archivos .env locales para las variables de las aplicaciones. */
function baseEnv(extra) {
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', ...extra };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  return env;
}

/**
 * Infra solo con PostgreSQL (sin Redis), con un puerto distinto para no colisionar con las E2E de Radar.
 */
class FeedInfra extends Infra {
  constructor(options = {}) {
    super({ prefix: 'social_unsch_e2e_feed', pgPort: 55443, redisPort: 56390, ...options });
  }

  async start() {
    this.removeContainers();
    const { execFileSync } = require('child_process');
    const docker = (args) => execFileSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    const dockerQuiet = (args) => { try { return docker(args); } catch { return null; } };
    try {
      docker(['run', '-d', '--name', this.pgName, '-p', `127.0.0.1:${this.o.pgPort}:5432`,
        '-e', 'POSTGRES_DB=social_unsch_e2e', '-e', 'POSTGRES_USER=e2e_user', '-e', 'POSTGRES_PASSWORD=e2e_password',
        this.o.pgImage]);
      await waitFor(
        () => dockerQuiet(['exec', this.pgName, 'pg_isready', '-h', '127.0.0.1', '-U', 'e2e_user', '-d', 'social_unsch_e2e']) !== null,
        { label: 'PostgreSQL (feed)', timeoutMs: 90000, intervalMs: 500 },
      );
    } catch (error) {
      this.removeContainers();
      throw error;
    }
  }

  /**
   * Ejecuta SQL en el PostgreSQL desechable y devuelve la salida sin formato.
   * Lanza con el mensaje de psql si falla, en lugar de devolver null: un error
   * silencioso aquí haría pasar por «siembra vacía» un fallo de esquema.
   *
   * Solo para sembrar y comprobar integridad en pruebas locales: nunca apunta a
   * una base remota (`assertLocalUrl` en start/migrate).
   */
  psql(sql) {
    const { execFileSync } = require('child_process');
    try {
      return execFileSync(
        'docker',
        ['exec', this.pgName, 'psql', '-U', 'e2e_user', '-d', 'social_unsch_e2e', '-v', 'ON_ERROR_STOP=1', '-tAc', sql],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      ).toString().trim();
    } catch (error) {
      const detail = (error.stderr || error.stdout || '').toString().trim();
      throw new Error(`psql falló: ${detail || error.message}`);
    }
  }

  /** Estadísticas del contenedor de PostgreSQL (no hay Redis en este arnés). */
  containerStats() {
    const { execFileSync } = require('child_process');
    try {
      return execFileSync('docker', ['stats', '--no-stream', '--format', '{{.Name}};{{.CPUPerc}};{{.MemUsage}}', this.pgName],
        { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n');
    } catch {
      return null;
    }
  }

  /** Levanta Redis desechable bajo demanda (para ensayos de matriz proxy/proxy). */
  async startRedisContainer() {
    const { execFileSync } = require('child_process');
    try { execFileSync('docker', ['rm', '-f', this.redisName], { stdio: 'pipe' }); } catch { /* no existe */ }
    execFileSync('docker', ['run', '-d', '--name', this.redisName, '-p', `127.0.0.1:${this.o.redisPort}:6379`, this.o.redisImage], { stdio: ['ignore', 'pipe', 'pipe'] });
    await waitFor(() => this.redisCli('PING') === 'PONG', { label: 'Redis (matriz feed/radar)', timeoutMs: 60000 });
  }

  /** Ejecuta SQL en el PostgreSQL desechable con un rol específico (para verificar permisos mínimos). */
  psqlAs(user, password, sql) {
    const { execFileSync } = require('child_process');
    return execFileSync(
      'docker',
      ['exec', '-e', `PGPASSWORD=${password}`, this.pgName, 'psql', '-h', '127.0.0.1', '-U', user, '-d', 'social_unsch_e2e', '-v', 'ON_ERROR_STOP=1', '-tAc', sql],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString().trim();
  }

  removeContainers() {
    const { execFileSync } = require('child_process');
    try { execFileSync('docker', ['rm', '-f', this.pgName, this.redisName], { stdio: 'pipe' }); } catch { /* no existe */ }
  }
}

/**
 * Crea un proceso compilado de apps/feed.
 * El servicio verifica JWT con RS256 usando solo la clave pública.
 */
function feedProcess({ port, databaseUrl, keys, allowedOrigins = 'http://localhost:3001' }) {
  assertLocalUrl(databaseUrl);
  const env = baseEnv({
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    JWT_PUBLIC_KEY: keys.publicKey,
    ALLOWED_ORIGINS: allowedOrigins,
    SERVICE_NAME: 'social-unsch-feed',
  });
  return new AppProcess('feed', FEED_DIR, path.join(FEED_DIR, 'dist', 'server.js'), env, port);
}

/**
 * Crea un proceso compilado de apps/api con soporte para FEED_MODE.
 */
function apiProcess({ port, databaseUrl, redisUrl, keys, radarMode = 'local', radarTarget,
  radarTimeoutMs, feedMode = 'local', feedTarget, feedTimeoutMs }) {
  assertLocalUrl(databaseUrl);
  if (redisUrl) assertLocalUrl(redisUrl);
  const env = baseEnv({
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_PRIVATE_KEY: keys.privateKey,
    JWT_PUBLIC_KEY: keys.publicKey,
    ALLOWED_ORIGINS: 'http://localhost:3001',
    RADAR_MODE: radarMode,
    RADAR_PROXY_TARGET: radarTarget,
    RADAR_PROXY_TIMEOUT_MS: radarTimeoutMs ? String(radarTimeoutMs) : undefined,
    FEED_MODE: feedMode,
    FEED_PROXY_TARGET: feedTarget,
    FEED_PROXY_TIMEOUT_MS: feedTimeoutMs ? String(feedTimeoutMs) : undefined,
  });
  return new AppProcess(`api-feed-${feedMode}`, API_DIR, path.join(API_DIR, 'dist', 'server.js'), env, port);
}

module.exports = { FeedInfra, feedProcess, radarProcess, apiProcess, blackHoleServer, generateKeys, waitFor, sleep, tcpOpen };
