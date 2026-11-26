#!/usr/bin/env node
'use strict';
/**
 * Benchmark reproducible de Feed con las aplicaciones reales.
 *
 * Ejecuta y compara, con PostgreSQL 16 real y desechable:
 *   A. apps/api compilada con FEED_MODE=local  → PostgreSQL
 *   B. apps/api compilada con FEED_MODE=proxy  → apps/feed compilada → PostgreSQL
 *
 * Escenarios:
 *   S1  GET /api/v1/feed con N usuarios simultáneos en bucle cerrado (cada usuario envía la
 *       siguiente solicitud al recibir la anterior). Usuarios simultáneos ≠ solicitudes por segundo.
 *   S2  POST /api/v1/feed a tasa fija (bucle abierto). Todas las escrituras son válidas; la
 *       integridad se comprueba contando filas en PostgreSQL, no confiando en las respuestas.
 *   S3  GET /api/v1/feed a tasa fija moderada (bucle abierto). Es diagnóstico: separa el costo del
 *       salto de red del efecto de la saturación de S1.
 *   C   Arranque en frío de cada proceso hasta /health/ready, medido aparte.
 *
 * Los modos se alternan (A, B, A, B, …) y solo uno está activo a la vez. Antes de cada repetición
 * `feed_posts` se vacía y se vuelve a sembrar con el mismo número de publicaciones, de modo que
 * ambos modos leen datos equivalentes. Toda respuesta que no cumpla el contrato o cuyo estado no
 * sea el esperado cuenta como error inesperado: estos escenarios no generan rechazos de negocio.
 *
 * UMBRALES: Feed no tiene umbrales aprobados por el propietario. Los de THRESHOLDS son una
 * PROPUESTA alineada con los ya acordados para Radar; mientras no se aprueben, los veredictos se
 * emiten como EXPLORATORIOS y no deben presentarse como criterios cumplidos.
 *
 * Uso: npm run bench:feed  (variables opcionales BENCH_REPS, BENCH_USERS, BENCH_S1_SECONDS,
 *      BENCH_S1_WARMUP_SECONDS, BENCH_S2_PER_MINUTE, BENCH_S2_SECONDS, BENCH_SEED_POSTS, BENCH_OUT)
 * Requiere Docker. Resultados válidos solo para el equipo, la carga y la duración medidos.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const { monitorEventLoopDelay } = require('perf_hooks');
const { FeedListResponseSchema, FeedCreateResponseSchema } = require('@social-unsch/contracts');
const jwt = require('jsonwebtoken');
const st = require('./lib/feed-stack');
const { ROOT } = require('./lib/radar-stack');
const { percentile, median } = require('./lib/measurement');

const cfg = {
  reps: Number(process.env.BENCH_REPS || 3),
  users: Number(process.env.BENCH_USERS || 50),
  s1Seconds: Number(process.env.BENCH_S1_SECONDS || 30),
  s1WarmupSeconds: Number(process.env.BENCH_S1_WARMUP_SECONDS || 10),
  s2PerMinute: Number(process.env.BENCH_S2_PER_MINUTE || 100),
  s2Seconds: Number(process.env.BENCH_S2_SECONDS || 60),
  s3PerSecond: Number(process.env.BENCH_S3_PER_SECOND || 20),
  s3Seconds: Number(process.env.BENCH_S3_SECONDS || 30),
  seedPosts: Number(process.env.BENCH_SEED_POSTS || 200),
  requestTimeoutMs: 10000,
};
for (const [key, value] of Object.entries(cfg)) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuración inválida: ${key}`);
}
if (!Number.isInteger(cfg.reps) || cfg.reps < 3 || cfg.s1Seconds < 30 || cfg.s1WarmupSeconds < 10) {
  throw new Error('La metodología exige >=3 repeticiones, >=30 s de medición y >=10 s de calentamiento');
}

// Puertos distintos en cada repetición: un puerto reutilizado tras matar el proceso anterior deja
// sockets keep-alive muertos en el pool del cliente y provoca errores de conexión ajenos al sistema.
const BASE_PORTS = { api: 3610, feed: 4610 };
let portOffset = 0;
const FEED_PATH = '/api/v1/feed';

/** PROPUESTA pendiente de aprobación del propietario; ver cabecera. */
const THRESHOLDS = { s1P95Ms: 500, overheadP95Pct: 20, s2P95Ms: 500 };
const THRESHOLDS_APPROVED = false;

const infra = new st.FeedInfra({ prefix: 'social_unsch_bench_feed', pgPort: 55462 });
const keys = st.generateKeys();

/** Usuarios reales en PostgreSQL: `feed_posts.user_id` tiene clave foránea y el listado hace JOIN. */
let benchUsers = [];
let readTokens = [];
let writeTokens = [];

const token = (id) => jwt.sign({ user_id: id, userId: id, role: 'student' }, keys.privateKey, { algorithm: 'RS256', expiresIn: '2h' });

function summarize(samples, durationS) {
  const ok = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  const timeouts = samples.filter((s) => s.timeout).length;
  return {
    requests: samples.length,
    ok: ok.length,
    unexpectedErrors: samples.length - ok.length - timeouts,
    timeouts,
    errorRatePct: samples.length ? ((samples.length - ok.length) / samples.length) * 100 : 0,
    rps: samples.length / durationS,
    // Las latencias se calculan sobre todas las solicitudes, incluidas las fallidas: excluirlas mejoraría el resultado.
    p50: percentile(all, 50), p95: percentile(all, 95), p99: percentile(all, 99), max: all[all.length - 1] ?? null,
  };
}

async function timed(url, init, { write = false } = {}) {
  const t0 = process.hrtime.bigint();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(cfg.requestTimeoutMs) });
    const body = await res.json().catch(() => null);
    const schema = write ? FeedCreateResponseSchema : FeedListResponseSchema;
    const valid = schema.safeParse(body).success;
    const expected = write ? 201 : 200;
    return { ok: res.status === expected && valid, status: res.status, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  } catch (e) {
    return { ok: false, status: 0, timeout: e.name === 'TimeoutError', ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  }
}

async function closedLoopRead(base, seconds) {
  const samples = [];
  const end = Date.now() + seconds * 1000;
  const worker = async (i) => {
    const headers = { authorization: `Bearer ${readTokens[i % readTokens.length]}` };
    while (Date.now() < end) samples.push(await timed(base + FEED_PATH, { headers }));
  };
  await Promise.all(Array.from({ length: cfg.users }, (_, i) => worker(i)));
  return samples;
}

async function openLoopRead(base, perSecond, seconds) {
  const interval = 1000 / perSecond;
  const total = Math.round(seconds * perSecond);
  const pending = [];
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    const wait = start + i * interval - Date.now();
    if (wait > 0) await st.sleep(wait);
    pending.push(timed(base + FEED_PATH, { headers: { authorization: `Bearer ${readTokens[i % readTokens.length]}` } }));
  }
  const samples = await Promise.all(pending);
  await st.sleep(Math.max(0, start + seconds * 1000 - Date.now()));
  return samples;
}

async function openLoopWrite(base, perMinute, seconds) {
  const interval = 60000 / perMinute;
  const total = Math.round((seconds * 1000) / interval);
  const pending = [];
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    const wait = start + i * interval - Date.now();
    if (wait > 0) await st.sleep(wait);
    pending.push(timed(base + FEED_PATH, {
      method: 'POST',
      headers: { authorization: `Bearer ${writeTokens[i % writeTokens.length]}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: `Publicación de benchmark ${i}` }),
    }, { write: true }));
  }
  const samples = await Promise.all(pending);
  await st.sleep(Math.max(0, start + seconds * 1000 - Date.now()));
  return samples;
}

/** Datos equivalentes en cada repetición: `feed_posts` vacía y sembrada con el mismo volumen. */
function seedPosts() {
  // CASCADE: `moderation_reports` y `moderation_audit_log` referencian `feed_posts`, así que
  // TRUNCATE sin cascada se rechaza aunque esas tablas estén vacías. Base desechable.
  infra.psql('TRUNCATE feed_posts CASCADE');
  const authors = benchUsers.map((id) => `'${id}'`).join(',');
  infra.psql(
    `INSERT INTO feed_posts (user_id, content, is_visible, created_at)
     SELECT (ARRAY[${authors}])[1 + (i % ${benchUsers.length})]::uuid,
            'Publicación sembrada ' || i, true, CURRENT_TIMESTAMP - (i || ' seconds')::interval
     FROM generate_series(1, ${cfg.seedPosts}) AS i`
  );
  const count = Number(infra.psql('SELECT count(*) FROM feed_posts'));
  if (count !== cfg.seedPosts) {
    throw new Error(`Siembra fallida: se esperaban ${cfg.seedPosts} publicaciones, hay ${count}`);
  }
}

async function startMode(mode) {
  const PORTS = { api: BASE_PORTS.api + portOffset, feed: BASE_PORTS.feed + portOffset };
  portOffset++;
  const procs = [];
  const cold = {};
  if (mode === 'proxy') {
    const feed = st.feedProcess({ port: PORTS.feed, databaseUrl: infra.databaseUrl, keys });
    feed.preload = path.join(__dirname, 'lib', 'bench-telemetry.js');
    cold.feedMs = await feed.start({ readyPath: '/health/ready' });
    procs.push(feed);
  }
  const api = st.apiProcess({
    port: PORTS.api, databaseUrl: infra.databaseUrl, keys,
    feedMode: mode, feedTarget: mode === 'proxy' ? `http://127.0.0.1:${PORTS.feed}` : undefined,
  });
  api.preload = path.join(__dirname, 'lib', 'bench-telemetry.js');
  cold.apiMs = await api.start({ readyPath: '/health/ready' });
  procs.push(api);
  return { api, procs, cold };
}

async function stopAll(procs) {
  for (const p of [...procs].reverse()) await p.stop();
}

async function measure(procs, run) {
  const started = Date.now();
  const cpu = process.cpuUsage();
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const containers = [];
  let pending = null;
  const poll = () => {
    if (pending) return;
    pending = new Promise((resolve) => execFile('docker',
      ['stats', '--no-stream', '--format', '{{.Name}};{{.CPUPerc}};{{.MemUsage}}', infra.pgName],
      { timeout: 5000 },
      (error, out) => {
        containers.push({ at: new Date().toISOString(), stats: error ? null : out.trim().split('\n') });
        resolve();
      })).finally(() => { pending = null; });
  };
  const timer = setInterval(poll, 5000);
  let samples;
  try { samples = await run(); } finally { clearInterval(timer); loop.disable(); }
  const end = Date.now();
  const seconds = (end - started) / 1000;
  const used = process.cpuUsage(cpu);
  const generator = {
    cpuPctOfOneCore: (used.user + used.system) / seconds / 10000,
    rssMb: process.memoryUsage().rss / 1048576,
    eventLoopP95Ms: loop.percentile(95) / 1e6,
    eventLoopMaxMs: loop.max / 1e6,
  };
  if (pending) await pending;
  return {
    samples, ...summarize(samples, seconds), durationS: seconds, generator, containers,
    usage: procs.map((p) => ({ name: p.name, samples: p.telemetry.filter((x) => x.at >= started && x.at <= end) })),
  };
}

async function runRep(mode, rep) {
  const { api, procs, cold } = await startMode(mode);
  try {
    seedPosts();
    await closedLoopRead(api.url, cfg.s1WarmupSeconds);
    const s1 = await measure(procs, () => closedLoopRead(api.url, cfg.s1Seconds));

    // Escrituras sobre una base sembrada igual, contando filas reales antes y después.
    seedPosts();
    const before = Number(infra.psql('SELECT count(*) FROM feed_posts'));
    const s2 = await measure(procs, () => openLoopWrite(api.url, cfg.s2PerMinute, cfg.s2Seconds));
    const after = Number(infra.psql('SELECT count(*) FROM feed_posts'));
    const expectedWrites = s2.requests;
    s2.integrity = {
      rowsBefore: before,
      rowsAfter: after,
      rowsAdded: after - before,
      expectedWrites,
      // Integridad real: cada 201 corresponde a exactamente una fila, sin duplicados ni pérdidas.
      pass: s2.ok === expectedWrites && after - before === expectedWrites,
    };

    seedPosts();
    await openLoopRead(api.url, cfg.s3PerSecond, 10);
    const s3 = await measure(procs, () => openLoopRead(api.url, cfg.s3PerSecond, cfg.s3Seconds));
    for (const s of [s1, s2, s3]) delete s.samples;

    return {
      mode, rep, cold,
      s1: { ...s1, users: cfg.users, seededPosts: cfg.seedPosts },
      s2: { ...s2, targetPerMinute: cfg.s2PerMinute },
      s3: { ...s3, targetPerSecond: cfg.s3PerSecond },
    };
  } finally {
    await stopAll(procs);
  }
}

const fmt = (x, d = 1) => (x === null || x === undefined ? '—' : Number(x).toFixed(d));

function environment() {
  const safe = (fn) => { try { return fn(); } catch { return null; } };
  return {
    date: new Date().toISOString(),
    commit: safe(() => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()),
    dirty: safe(() => execFileSync('git', ['status', '--porcelain', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'], { cwd: ROOT }).toString().trim() !== ''),
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    cpu: `${os.cpus()[0].model} × ${os.cpus().length}`,
    memoryGb: Number((os.totalmem() / 1073741824).toFixed(1)),
    docker: safe(() => execFileSync('docker', ['version', '--format', '{{.Server.Version}}']).toString().trim()),
    images: ['postgres:16-alpine'],
    config: cfg,
    foreignContainers: safe(() => execFileSync('docker', ['ps', '--format', '{{.Names}}']).toString().trim().split('\n').filter((x) => !x.startsWith('social_unsch_')).length),
    note: 'Generador de carga, API, Feed y PostgreSQL comparten el mismo equipo y loopback. No representa la plataforma de producción. La API corre con RADAR_MODE=local sin Redis disponible, por lo que su cliente Redis reintenta en segundo plano; ocurre igual en los dos modos de Feed, así que no sesga la comparación, pero sí añade ruido a las cifras absolutas.',
  };
}

/** Registra los usuarios del benchmark usando la API real, para que existan en `users`. */
async function registerBenchUsers() {
  const { api, procs } = await startMode('local');
  try {
    const ids = [];
    // `full_name` solo admite letras y espacios: nada de dígitos en el nombre.
    const names = ['Estudiante Bench Uno', 'Estudiante Bench Dos', 'Estudiante Bench Tres'];
    for (let i = 0; i < names.length; i++) {
      const email = `bench.feed.${Date.now()}.${i}@unsch.edu.pe`;
      const password = 'Prueba#Bench2026';
      const reg = await fetch(api.url + '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: names[i], email, password, role: 'student' }),
      });
      if (reg.status !== 201) {
        throw new Error(`Registro de usuario de benchmark falló (${reg.status}): ${JSON.stringify(await reg.json().catch(() => null))}`);
      }
      const login = await fetch(api.url + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await login.json();
      if (login.status !== 200 || !body.user?.id) throw new Error(`Inicio de sesión de benchmark falló (${login.status})`);
      ids.push(body.user.id);
    }
    return ids;
  } finally {
    await stopAll(procs);
  }
}

async function main() {
  const env = environment();
  console.log(`Benchmark Feed real · commit ${env.commit} · ${env.cpu} · Node ${env.node}`);
  if (!THRESHOLDS_APPROVED) console.log('AVISO: umbrales de Feed PROPUESTOS, no aprobados. Resultados EXPLORATORIOS.\n');
  await infra.start();
  const results = [];
  try {
    infra.migrate();
    benchUsers = await registerBenchUsers();
    readTokens = benchUsers.map(token);
    writeTokens = benchUsers.map(token);
    console.log(`  usuarios de benchmark registrados: ${benchUsers.length}`);

    for (let rep = 1; rep <= cfg.reps; rep++) {
      for (const mode of ['local', 'proxy']) {
        process.stdout.write(`  repetición ${rep}, modo ${mode}… `);
        const r = await runRep(mode, rep);
        results.push(r);
        const errs = ['s1', 's2', 's3'].reduce((a, k) => a + r[k].unexpectedErrors + r[k].timeouts, 0);
        console.log(`S1 p95 ${fmt(r.s1.p95, 2)} ms, ${fmt(r.s1.rps, 0)} rps · S2 p95 ${fmt(r.s2.p95, 2)} ms (filas +${r.s2.integrity.rowsAdded}) · S3 p95 ${fmt(r.s3.p95, 2)} ms · errores ${errs}`);
      }
    }
  } finally {
    infra.removeContainers();
  }

  const byMode = (m) => results.filter((r) => r.mode === m);
  const agg = Object.fromEntries(['local', 'proxy'].map((m) => {
    const rs = byMode(m);
    return [m, {
      s1P50MedianMs: median(rs.map((r) => r.s1.p50)),
      s1P95MedianMs: median(rs.map((r) => r.s1.p95)),
      s1P99MedianMs: median(rs.map((r) => r.s1.p99)),
      s1RpsMedian: median(rs.map((r) => r.s1.rps)),
      s1Errors: rs.reduce((a, r) => a + r.s1.unexpectedErrors + r.s1.timeouts, 0),
      s2P95MedianMs: median(rs.map((r) => r.s2.p95)),
      s2Errors: rs.reduce((a, r) => a + r.s2.unexpectedErrors + r.s2.timeouts, 0),
      s3P50MedianMs: median(rs.map((r) => r.s3.p50)),
      s3P95MedianMs: median(rs.map((r) => r.s3.p95)),
      s3Errors: rs.reduce((a, r) => a + r.s3.unexpectedErrors + r.s3.timeouts, 0),
      coldApiMedianMs: median(rs.map((r) => r.cold.apiMs)),
      coldFeedMedianMs: median(rs.map((r) => r.cold.feedMs ?? null)),
    }];
  }));

  const overheadPct = ((agg.proxy.s1P95MedianMs - agg.local.s1P95MedianMs) / agg.local.s1P95MedianMs) * 100;
  const s3OverheadPct = ((agg.proxy.s3P95MedianMs - agg.local.s3P95MedianMs) / agg.local.s3P95MedianMs) * 100;
  const s2OverheadPct = ((agg.proxy.s2P95MedianMs - agg.local.s2P95MedianMs) / agg.local.s2P95MedianMs) * 100;

  const pairs = Array.from({ length: cfg.reps }, (_, i) => {
    const a = results.find((r) => r.rep === i + 1 && r.mode === 'local').s1.p95;
    const b = results.find((r) => r.rep === i + 1 && r.mode === 'proxy').s1.p95;
    return { rep: i + 1, localP95: a, proxyP95: b, additionalMs: b - a, overheadPct: ((b - a) / a) * 100, withinProposedThreshold: ((b - a) / a) * 100 <= THRESHOLDS.overheadP95Pct };
  });

  const verdicts = [
    [`S1 p95 < ${THRESHOLDS.s1P95Ms} ms con ${cfg.users} usuarios, modo local`, byMode('local').every((r) => r.s1.p95 < THRESHOLDS.s1P95Ms && r.s1.ok === r.s1.requests)],
    [`S1 p95 < ${THRESHOLDS.s1P95Ms} ms con ${cfg.users} usuarios, modo proxy`, byMode('proxy').every((r) => r.s1.p95 < THRESHOLDS.s1P95Ms && r.s1.ok === r.s1.requests)],
    [`S1 sobrecarga p95 del proxy en lecturas <= ${THRESHOLDS.overheadP95Pct} % (mediana)`, overheadPct <= THRESHOLDS.overheadP95Pct],
    // Cada par cuenta por separado: una mediana dentro del umbral puede ocultar repeticiones fuera.
    [`S1 sobrecarga <= ${THRESHOLDS.overheadP95Pct} % en TODAS las repeticiones`, pairs.every((p) => p.withinProposedThreshold)],
    [`S2 sobrecarga p95 del proxy en escrituras <= ${THRESHOLDS.overheadP95Pct} %`, s2OverheadPct <= THRESHOLDS.overheadP95Pct],
    [`S2 ${cfg.s2PerMinute} publicaciones/min sin errores ni pérdida de filas, ambos modos`, results.every((r) => r.s2.integrity.pass)],
    [`S2 p95 < ${THRESHOLDS.s2P95Ms} ms, ambos modos`, agg.local.s2P95MedianMs < THRESHOLDS.s2P95Ms && agg.proxy.s2P95MedianMs < THRESHOLDS.s2P95Ms],
  ].map(([criterion, pass]) => ({ criterion, pass, status: THRESHOLDS_APPROVED ? (pass ? 'CUMPLE' : 'NO CUMPLE') : 'EXPLORATORIO' }));

  const out = {
    environment: env,
    thresholds: THRESHOLDS,
    thresholdsApproved: THRESHOLDS_APPROVED,
    thresholdsNote: 'Umbrales PROPUESTOS por analogía con Radar. Mientras no los apruebe el propietario, los veredictos son EXPLORATORIOS.',
    aggregate: agg,
    overheadP95Pct: overheadPct,
    additionalP95Ms: agg.proxy.s1P95MedianMs - agg.local.s1P95MedianMs,
    writeOverheadP95Pct: s2OverheadPct,
    pairs,
    diagnosticS3OverheadP95Pct: s3OverheadPct,
    verdicts,
    runs: results,
  };
  const file = process.env.BENCH_OUT || path.join(ROOT, 'docs', 'migracion', 'evidencias', `benchmark-feed-${env.date.slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', { flag: 'wx' });

  console.log('\n| Modo | S1 p50 | S1 p95 | S1 p99 | S1 rps | S1 err | S2 p95 | S2 err | S3 p50 | S3 p95 | Arranque API | Arranque Feed |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of ['local', 'proxy']) {
    const a = agg[m];
    console.log(`| ${m} | ${fmt(a.s1P50MedianMs, 2)} ms | ${fmt(a.s1P95MedianMs, 2)} ms | ${fmt(a.s1P99MedianMs, 2)} ms | ${fmt(a.s1RpsMedian, 0)} | ${a.s1Errors} | ${fmt(a.s2P95MedianMs, 2)} ms | ${a.s2Errors} | ${fmt(a.s3P50MedianMs, 2)} ms | ${fmt(a.s3P95MedianMs, 2)} ms | ${fmt(a.coldApiMedianMs, 0)} ms | ${fmt(a.coldFeedMedianMs, 0)} ms |`);
  }
  console.log(`\nSobrecarga p95 del proxy · lecturas S1: ${fmt(overheadPct)} % · escrituras S2: ${fmt(s2OverheadPct)} % · diagnóstico S3: ${fmt(s3OverheadPct)} %`);
  for (const v of verdicts) console.log(`${v.status.padEnd(13)} ${v.criterion}${THRESHOLDS_APPROVED ? '' : ` (medido: ${v.pass ? 'dentro' : 'fuera'} del umbral propuesto)`}`);
  console.log(`\nResultados: ${path.relative(ROOT, file)}`);
}

main().catch((e) => {
  console.error(e);
  infra.removeContainers();
  process.exit(1);
});
