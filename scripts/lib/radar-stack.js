'use strict';
/**
 * Infraestructura real y desechable para las pruebas E2E y el benchmark de Radar.
 *
 * Levanta PostgreSQL y Redis en contenedores propios (prefijo social_unsch_e2e_), aplica las
 * migraciones reales y arranca las aplicaciones compiladas (apps/api/dist y apps/radar/dist)
 * en procesos separados. Todas las variables de entorno se fijan de forma explícita para que
 * ningún archivo .env local pueda dirigir los procesos a servicios remotos.
 */

const { spawn, execFileSync } = require('child_process');
const crypto = require('crypto');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const RADAR_DIR = path.join(ROOT, 'apps', 'radar');

const DEFAULTS = {
  prefix: 'social_unsch_e2e',
  pgPort: 55442,
  redisPort: 56389,
  pgImage: 'postgres:16-alpine',
  redisImage: 'redis:7-alpine',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function docker(args, opts = {}) {
  return execFileSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString().trim();
}

function dockerQuiet(args) {
  try {
    return docker(args);
  } catch {
    return null;
  }
}

/** Rechaza cualquier destino que no sea un servicio local de prueba. */
function assertLocalUrl(url) {
  const u = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname)) {
    throw new Error(`SEGURIDAD: destino no local rechazado (${u.protocol}//${u.hostname}).`);
  }
}

async function waitFor(check, { timeoutMs = 60000, intervalMs = 250, label = 'condición' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (e) {
      lastError = e;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Tiempo agotado esperando ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function tcpOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

class Infra {
  constructor(options = {}) {
    this.o = { ...DEFAULTS, ...options };
    this.pgName = `${this.o.prefix}_pg`;
    this.redisName = `${this.o.prefix}_redis`;
    this.databaseUrl = `postgres://e2e_user:e2e_password@127.0.0.1:${this.o.pgPort}/social_unsch_e2e`;
    this.redisUrl = `redis://127.0.0.1:${this.o.redisPort}`;
  }

  async start() {
    this.removeContainers();
    try {
      docker(['run', '-d', '--name', this.pgName, '-p', `127.0.0.1:${this.o.pgPort}:5432`,
        '-e', 'POSTGRES_DB=social_unsch_e2e', '-e', 'POSTGRES_USER=e2e_user', '-e', 'POSTGRES_PASSWORD=e2e_password',
        this.o.pgImage]);
      docker(['run', '-d', '--name', this.redisName, '-p', `127.0.0.1:${this.o.redisPort}:6379`, this.o.redisImage]);
      await waitFor(() => dockerQuiet(['exec', this.pgName, 'pg_isready', '-h', '127.0.0.1', '-U', 'e2e_user', '-d', 'social_unsch_e2e']) !== null,
        { label: 'PostgreSQL', timeoutMs: 90000, intervalMs: 500 });
      await waitFor(() => this.redisCli('PING') === 'PONG', { label: 'Redis', timeoutMs: 60000 });
    } catch (error) {
      this.removeContainers();
      throw error;
    }
  }

  /**
   * Aplica migraciones y catálogos reales con los scripts del repositorio.
   * pg_isready usa TCP (-h): el servidor temporal de inicialización de la imagen solo escucha por socket
   * y, sin -h, se daría por listo antes del reinicio final.
   */
  migrate() {
    assertLocalUrl(this.databaseUrl);
    const env = { ...process.env, DATABASE_URL: this.databaseUrl, NODE_ENV: 'test' };
    for (const script of ['db:migrate', 'db:catalogs']) {
      try {
        if (process.platform === 'win32') {
          execFileSync('cmd.exe', ['/d', '/s', '/c', `npm run ${script} -w @social-unsch/api`], { cwd: ROOT, env, stdio: 'pipe' });
        } else {
          execFileSync('npm', ['run', script, '-w', '@social-unsch/api'], { cwd: ROOT, env, stdio: 'pipe' });
        }
      } catch (error) {
        throw new Error(`${script} falló:
${error.stdout || ''}${error.stderr || ''}`);
      }
    }
  }

  redisCli(...args) {
    return dockerQuiet(['exec', this.redisName, 'redis-cli', ...args]);
  }

  flushRedis() {
    return this.redisCli('FLUSHALL');
  }

  stopRedis() { docker(['stop', '-t', '1', this.redisName]); }
  startRedis() { docker(['start', this.redisName]); }
  pauseRedis() { docker(['pause', this.redisName]); }
  unpauseRedis() { docker(['unpause', this.redisName]); }
  stopPostgres() { docker(['stop', '-t', '1', this.pgName]); }
  startPostgres() { docker(['start', this.pgName]); }

  async waitRedisUp() {
    await waitFor(() => this.redisCli('PING') === 'PONG', { label: 'Redis restablecido', timeoutMs: 60000 });
  }

  async waitPostgresUp() {
    await waitFor(() => dockerQuiet(['exec', this.pgName, 'pg_isready', '-h', '127.0.0.1', '-U', 'e2e_user', '-d', 'social_unsch_e2e']) !== null,
      { label: 'PostgreSQL restablecido', timeoutMs: 90000, intervalMs: 500 });
  }

  /** Estadísticas de CPU y memoria de los contenedores, si están disponibles. */
  containerStats() {
    const out = dockerQuiet(['stats', '--no-stream', '--format', '{{.Name}};{{.CPUPerc}};{{.MemUsage}}', this.pgName, this.redisName]);
    if (!out) return [];
    return out.split('\n').map((l) => {
      const [name, cpu, mem] = l.split(';');
      return { name, cpu, mem };
    });
  }

  removeContainers() {
    dockerQuiet(['rm', '-f', this.pgName, this.redisName]);
  }
}

function generateKeys() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** Entorno base: nada se hereda de archivos .env para las variables que leen las aplicaciones. */
function baseEnv(extra) {
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', ...extra };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  return env;
}

class AppProcess {
  constructor(name, cwd, entry, env, port) {
    this.name = name;
    this.cwd = cwd;
    this.entry = entry;
    this.env = env;
    this.port = port;
    this.logs = [];
    this.telemetry = [];
    this.child = null;
    this.exit = null;
  }

  get url() {
    return `http://127.0.0.1:${this.port}`;
  }

  async start({ readyPath = '/health/live', timeoutMs = 30000 } = {}) {
    if (await tcpOpen(this.port)) throw new Error(`${this.name}: el puerto ${this.port} ya está ocupado`);
    const startedAt = process.hrtime.bigint();
    this.exit = null;
    this.child = spawn(process.execPath, [...(this.preload ? ['--require', this.preload] : []), this.entry], { cwd: this.cwd, env: this.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = () => {
      let pending = '';
      return (chunk) => {
      const lines = (pending + chunk.toString()).split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) if (line) {
        if (line.startsWith('{"type":"bench-resource"')) {
          try { this.telemetry.push(JSON.parse(line)); } catch { /* no métricas parciales */ }
        } else this.logs.push(line);
      }
      if (this.logs.length > 20000) this.logs.splice(0, this.logs.length - 20000);
      };
    };
    this.child.stdout.on('data', collect());
    this.child.stderr.on('data', collect());
    this.exitPromise = new Promise((resolve) => this.child.once('exit', (code, signal) => {
      this.exit = { code, signal };
      resolve(this.exit);
    }));
    await waitFor(async () => {
      if (this.exit) throw new Error(`${this.name} terminó al arrancar: ${JSON.stringify(this.exit)}\n${this.logs.slice(-15).join('\n')}`);
      const res = await fetch(this.url + readyPath).catch(() => null);
      return res !== null && res.status === 200;
    }, { label: `${this.name} en ${readyPath}`, timeoutMs, intervalMs: 50 });
    return Number(process.hrtime.bigint() - startedAt) / 1e6;
  }

  /** Envía SIGTERM y espera la salida; fuerza la terminación si excede el plazo. */
  async stop(timeoutMs = 12000) {
    if (!this.child || this.exit) return this.exit;
    this.child.kill('SIGTERM');
    const result = await Promise.race([this.exitPromise, sleep(timeoutMs).then(() => null)]);
    if (!result) {
      this.child.kill('SIGKILL');
      await this.exitPromise;
      return { forced: true, ...this.exit };
    }
    return result;
  }

  pid() {
    return this.child && !this.exit ? this.child.pid : null;
  }
}

function apiProcess({ port, databaseUrl, redisUrl, keys, radarMode = 'local', radarTarget, radarTimeoutMs }) {
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
  });
  return new AppProcess(`api-${radarMode}`, API_DIR, path.join(API_DIR, 'dist', 'server.js'), env, port);
}

function radarProcess({ port, redisUrl, keys }) {
  assertLocalUrl(redisUrl);
  const env = baseEnv({
    PORT: String(port),
    REDIS_URL: redisUrl,
    JWT_PUBLIC_KEY: keys.publicKey,
    ALLOWED_ORIGINS: 'http://localhost:3001',
    SERVICE_NAME: 'social-unsch-radar',
  });
  return new AppProcess('radar', RADAR_DIR, path.join(RADAR_DIR, 'dist', 'server.js'), env, port);
}

/** Servidor TCP que acepta conexiones y nunca responde: destino para probar el límite de tiempo del proxy. */
function blackHoleServer(port) {
  const sockets = new Set();
  const server = net.createServer((s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    s.on('error', () => undefined);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    close: () => new Promise((r) => {
      for (const s of sockets) s.destroy();
      server.close(() => r());
    }),
  })));
}

/** Uso de CPU acumulado (s) y memoria residente (MB) de un proceso, por plataforma. */
function processUsage(pid) {
  if (!pid) return null;
  try {
    if (process.platform === 'linux') {
      const fs = require('fs');
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
      const ticks = Number(stat[11]) + Number(stat[12]);
      const rssPages = Number(stat[21]);
      return { cpuSeconds: ticks / 100, rssMb: (rssPages * 4096) / 1048576 };
    }
    if (process.platform === 'win32') {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
        `$p=Get-Process -Id ${pid}; "$($p.TotalProcessorTime.TotalSeconds);$($p.WorkingSet64)"`]).toString().trim();
      const [cpu, ws] = out.split(';');
      return { cpuSeconds: Number(cpu.replace(',', '.')), rssMb: Number(ws) / 1048576 };
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = {
  ROOT, Infra, AppProcess, apiProcess, radarProcess, blackHoleServer, generateKeys,
  processUsage, waitFor, sleep, tcpOpen, assertLocalUrl,
};
