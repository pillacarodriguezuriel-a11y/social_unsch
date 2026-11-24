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
const { ROOT, Infra, AppProcess, generateKeys, assertLocalUrl, waitFor, sleep, tcpOpen } = require('./radar-stack');

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

  removeContainers() {
    const { execFileSync } = require('child_process');
    try { execFileSync('docker', ['rm', '-f', this.pgName], { stdio: 'pipe' }); } catch { /* no existe */ }
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

module.exports = { FeedInfra, feedProcess, apiProcess, generateKeys, waitFor, sleep, tcpOpen };
