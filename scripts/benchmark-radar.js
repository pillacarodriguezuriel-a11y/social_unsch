#!/usr/bin/env node
'use strict';
/**
 * Benchmark reproducible de Radar con las aplicaciones reales.
 *
 * Sustituye al script anterior, que simulaba ambos servidores con http.createServer y un almacén
 * en memoria y, por tanto, no medía el sistema. Este ejecuta:
 *   A. apps/api compilada con RADAR_MODE=local      → Redis real
 *   B. apps/api compilada con RADAR_MODE=proxy → apps/radar compilada → Redis real
 * con PostgreSQL real para la disponibilidad de la API.
 *
 * Escenarios:
 *   S1  GET /api/v1/radar/status con N usuarios simultáneos en bucle cerrado (cada usuario envía
 *       la siguiente solicitud al recibir la anterior). Usuarios simultáneos ≠ solicitudes por segundo.
 *   S2  POST /api/v1/radar/report a tasa fija (bucle abierto), todos los votos válidos y de usuarios distintos.
 *   S3  GET /api/v1/radar/status a tasa fija moderada (bucle abierto). Es diagnóstico: separa el costo
 *       del salto de red del efecto de la saturación de S1. Los umbrales se evalúan sobre S1 y S2.
 *   C   Arranque en frío del proceso hasta /health/ready, medido aparte.
 *
 * Los modos se alternan (A, B, A, B, …) y solo uno está activo a la vez. Redis se vacía y se
 * vuelve a sembrar igual antes de cada repetición. Todo error distinto de 200 cuenta como error
 * inesperado: estos escenarios no generan rechazos de negocio.
 *
 * Uso: npm run bench:radar  (variables opcionales BENCH_REPS, BENCH_USERS, BENCH_S1_SECONDS,
 *      BENCH_S1_WARMUP_SECONDS, BENCH_S2_PER_MINUTE, BENCH_S2_SECONDS, BENCH_OUT)
 * Requiere Docker. Resultados válidos solo para el equipo, la carga y la duración medidos.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const jwt = require('jsonwebtoken');
const st = require('./lib/radar-stack');

const cfg = {
  reps: Number(process.env.BENCH_REPS || 3),
  users: Number(process.env.BENCH_USERS || 50),
  s1Seconds: Number(process.env.BENCH_S1_SECONDS || 30),
  s1WarmupSeconds: Number(process.env.BENCH_S1_WARMUP_SECONDS || 10),
  s2PerMinute: Number(process.env.BENCH_S2_PER_MINUTE || 100),
  s2Seconds: Number(process.env.BENCH_S2_SECONDS || 60),
  s3PerSecond: Number(process.env.BENCH_S3_PER_SECOND || 20),
  s3Seconds: Number(process.env.BENCH_S3_SECONDS || 30),
  requestTimeoutMs: 10000,
};
// Puertos distintos en cada repetición: un puerto reutilizado tras matar el proceso anterior deja
// sockets keep-alive muertos en el pool del cliente y provoca errores de conexión ajenos al sistema.
const BASE_PORTS = { api: 3510, radar: 4510 };
let portOffset = 0;
const STATUS = '/api/v1/radar/status';
const REPORT = '/api/v1/radar/report';
const THRESHOLDS = { s1P95Ms: 500, overheadP95Pct: 20, s2P95Ms: 500 };

const infra = new st.Infra({ prefix: 'social_unsch_bench', pgPort: 55452, redisPort: 56399 });
const keys = st.generateKeys();
const token = (id) => jwt.sign({ user_id: id, role: 'student' }, keys.privateKey, { algorithm: 'RS256', expiresIn: '2h' });
const statusTokens = Array.from({ length: 200 }, (_, i) => token(`bench-status-${i}`));
let reportSeq = 0;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

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

async function timed(url, init) {
  const t0 = process.hrtime.bigint();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(cfg.requestTimeoutMs) });
    await res.arrayBuffer();
    return { ok: res.status === 200, status: res.status, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  } catch (e) {
    return { ok: false, status: 0, timeout: e.name === 'TimeoutError', ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  }
}

async function closedLoop(base, seconds) {
  const samples = [];
  const end = Date.now() + seconds * 1000;
  const worker = async (i) => {
    const headers = { authorization: `Bearer ${statusTokens[i % statusTokens.length]}` };
    while (Date.now() < end) samples.push(await timed(base + STATUS, { headers }));
  };
  await Promise.all(Array.from({ length: cfg.users }, (_, i) => worker(i)));
  return samples;
}

const REPORT_TARGETS = [
  ['comedor', ['fluid', 'medium_queue', 'Cola Larga', 'Cerrado']],
  ['rectorado', ['empty_window', 'waiting_15', 'Colapsado']],
  ['biblioteca_floor_1', ['20', '40', '60']],
  ['biblioteca_floor_3', ['10', '50', '90']],
  ['campus_alert', ['cultural_event', 'Clase suspendida']],
];

async function openLoop(base, perMinute, seconds) {
  const interval = 60000 / perMinute;
  const total = Math.round((seconds * 1000) / interval);
  const pending = [];
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    const wait = start + i * interval - Date.now();
    if (wait > 0) await st.sleep(wait);
    const [node, values] = REPORT_TARGETS[i % REPORT_TARGETS.length];
    const status = values[Math.floor(i / REPORT_TARGETS.length) % values.length];
    pending.push(timed(base + REPORT, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(`bench-report-${++reportSeq}`)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ node, status }),
    }));
  }
  return Promise.all(pending);
}

/** Datos equivalentes en cada repetición: Redis vacío y tres nodos con consenso publicado. */
async function seed(base) {
  infra.flushRedis();
  for (const [node, status] of [['comedor', 'fluid'], ['rectorado', 'waiting_15'], ['biblioteca_floor_2', '50']]) {
    for (let i = 0; i < 3; i++) {
      const r = await timed(base + REPORT, {
        method: 'POST',
        headers: { authorization: `Bearer ${token(`bench-seed-${node}-${i}`)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ node, status }),
      });
      if (!r.ok) throw new Error(`Siembra fallida (${r.status})`);
    }
  }
}

async function openLoopStatus(base, perSecond, seconds) {
  const interval = 1000 / perSecond;
  const total = Math.round(seconds * perSecond);
  const pending = [];
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    const wait = start + i * interval - Date.now();
    if (wait > 0) await st.sleep(wait);
    pending.push(timed(base + STATUS, { headers: { authorization: `Bearer ${statusTokens[i % statusTokens.length]}` } }));
  }
  return Promise.all(pending);
}

async function startMode(mode) {
  const PORTS = { api: BASE_PORTS.api + portOffset, radar: BASE_PORTS.radar + portOffset };
  portOffset++;
  const procs = [];
  const cold = {};
  if (mode === 'proxy') {
    const radar = st.radarProcess({ port: PORTS.radar, redisUrl: infra.redisUrl, keys });
    cold.radarMs = await radar.start({ readyPath: '/health/ready' });
    procs.push(radar);
  }
  const api = st.apiProcess({
    port: PORTS.api, databaseUrl: infra.databaseUrl, redisUrl: infra.redisUrl, keys,
    radarMode: mode, radarTarget: mode === 'proxy' ? `http://127.0.0.1:${PORTS.radar}` : undefined,
  });
  cold.apiMs = await api.start({ readyPath: '/health/ready' });
  procs.push(api);
  return { api, procs, cold };
}

async function stopAll(procs) {
  for (const p of [...procs].reverse()) await p.stop();
}

function usageDelta(procs, before, seconds) {
  return procs.map((p, i) => {
    const after = st.processUsage(p.pid());
    if (!before[i] || !after) return { name: p.name, cpuPctOfOneCore: null, rssMb: null };
    return { name: p.name, cpuPctOfOneCore: ((after.cpuSeconds - before[i].cpuSeconds) / seconds) * 100, rssMb: after.rssMb };
  });
}

async function runRep(mode, rep) {
  const { api, procs, cold } = await startMode(mode);
  try {
    await seed(api.url);
    await closedLoop(api.url, cfg.s1WarmupSeconds);
    let before = procs.map((p) => st.processUsage(p.pid()));
    let t0 = Date.now();
    const s1 = await closedLoop(api.url, cfg.s1Seconds);
    const s1Duration = (Date.now() - t0) / 1000;
    const s1Usage = usageDelta(procs, before, s1Duration);
    const s1Containers = infra.containerStats();

    await seed(api.url);
    before = procs.map((p) => st.processUsage(p.pid()));
    t0 = Date.now();
    const s2 = await openLoop(api.url, cfg.s2PerMinute, cfg.s2Seconds);
    const s2Duration = (Date.now() - t0) / 1000;
    const s2Usage = usageDelta(procs, before, s2Duration);

    t0 = Date.now();
    const s3 = await openLoopStatus(api.url, cfg.s3PerSecond, cfg.s3Seconds);
    const s3Duration = (Date.now() - t0) / 1000;

    return {
      mode, rep, cold,
      s1: { ...summarize(s1, s1Duration), durationS: s1Duration, users: cfg.users, usage: s1Usage, containers: s1Containers },
      s2: { ...summarize(s2, s2Duration), durationS: s2Duration, targetPerMinute: cfg.s2PerMinute, usage: s2Usage },
      s3: { ...summarize(s3, s3Duration), durationS: s3Duration, targetPerSecond: cfg.s3PerSecond },
    };
  } finally {
    await stopAll(procs);
  }
}

const median = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const fmt = (x, d = 1) => (x === null || x === undefined ? '—' : Number(x).toFixed(d));

function environment() {
  const safe = (fn) => { try { return fn(); } catch { return null; } };
  return {
    date: new Date().toISOString(),
    commit: safe(() => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: st.ROOT }).toString().trim()),
    dirty: safe(() => execFileSync('git', ['status', '--porcelain', '--', 'apps', 'packages'], { cwd: st.ROOT }).toString().trim() !== ''),
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    cpu: `${os.cpus()[0].model} × ${os.cpus().length}`,
    memoryGb: Number((os.totalmem() / 1073741824).toFixed(1)),
    docker: safe(() => execFileSync('docker', ['version', '--format', '{{.Server.Version}}']).toString().trim()),
    images: ['postgres:16-alpine', 'redis:7-alpine'],
    config: cfg,
    note: 'Generador de carga, API, Radar y contenedores comparten el mismo equipo. No representa la plataforma de producción.',
  };
}

async function main() {
  const env = environment();
  console.log(`Benchmark Radar real · commit ${env.commit} · ${env.cpu} · Node ${env.node}`);
  await infra.start();
  const results = [];
  try {
    infra.migrate();
    for (let rep = 1; rep <= cfg.reps; rep++) {
      for (const mode of ['local', 'proxy']) {
        process.stdout.write(`  repetición ${rep}, modo ${mode}… `);
        const r = await runRep(mode, rep);
        results.push(r);
        console.log(`S1 p95 ${fmt(r.s1.p95, 2)} ms, ${fmt(r.s1.rps, 0)} rps · S2 p95 ${fmt(r.s2.p95, 2)} ms · S3 p95 ${fmt(r.s3.p95, 2)} ms, errores ${r.s1.unexpectedErrors + r.s1.timeouts + r.s2.unexpectedErrors + r.s2.timeouts + r.s3.unexpectedErrors + r.s3.timeouts}`);
      }
    }
  } finally {
    infra.removeContainers();
  }

  const byMode = (m) => results.filter((r) => r.mode === m);
  const agg = Object.fromEntries(['local', 'proxy'].map((m) => {
    const rs = byMode(m);
    return [m, {
      s1P95MedianMs: median(rs.map((r) => r.s1.p95)),
      s1P50MedianMs: median(rs.map((r) => r.s1.p50)),
      s1P99MedianMs: median(rs.map((r) => r.s1.p99)),
      s1RpsMedian: median(rs.map((r) => r.s1.rps)),
      s1Errors: rs.reduce((a, r) => a + r.s1.unexpectedErrors + r.s1.timeouts, 0),
      s2P95MedianMs: median(rs.map((r) => r.s2.p95)),
      s2Errors: rs.reduce((a, r) => a + r.s2.unexpectedErrors + r.s2.timeouts, 0),
      s3P50MedianMs: median(rs.map((r) => r.s3.p50)),
      s3P95MedianMs: median(rs.map((r) => r.s3.p95)),
      s3Errors: rs.reduce((a, r) => a + r.s3.unexpectedErrors + r.s3.timeouts, 0),
      coldApiMedianMs: median(rs.map((r) => r.cold.apiMs)),
      coldRadarMedianMs: median(rs.map((r) => r.cold.radarMs ?? null)),
    }];
  }));
  const overheadPct = ((agg.proxy.s1P95MedianMs - agg.local.s1P95MedianMs) / agg.local.s1P95MedianMs) * 100;
  const s3OverheadPct = ((agg.proxy.s3P95MedianMs - agg.local.s3P95MedianMs) / agg.local.s3P95MedianMs) * 100;
  const verdicts = [
    ['S1 p95 < 500 ms con 50 usuarios, modo local', agg.local.s1P95MedianMs < THRESHOLDS.s1P95Ms],
    ['S1 p95 < 500 ms con 50 usuarios, modo proxy', agg.proxy.s1P95MedianMs < THRESHOLDS.s1P95Ms],
    ['S1 sobrecarga p95 del proxy ≤ 20 %', overheadPct <= THRESHOLDS.overheadP95Pct],
    ['S2 100 reportes/min sin errores inesperados, ambos modos', agg.local.s2Errors === 0 && agg.proxy.s2Errors === 0],
    ['S2 p95 < 500 ms, ambos modos', agg.local.s2P95MedianMs < THRESHOLDS.s2P95Ms && agg.proxy.s2P95MedianMs < THRESHOLDS.s2P95Ms],
  ].map(([criterion, pass]) => ({ criterion, pass }));

  const out = { environment: env, thresholds: THRESHOLDS, aggregate: agg, overheadP95Pct: overheadPct, diagnosticS3OverheadP95Pct: s3OverheadPct, verdicts, runs: results };
  const file = process.env.BENCH_OUT || path.join(st.ROOT, 'docs', 'migracion', 'evidencias', `benchmark-radar-${env.date.slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

  console.log('\n| Modo | S1 p50 | S1 p95 | S1 p99 | S1 rps | S1 errores | S2 p95 | S2 errores | Arranque API | Arranque Radar |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const m of ['local', 'proxy']) {
    const a = agg[m];
    console.log(`| ${m} | ${fmt(a.s1P50MedianMs, 2)} ms | ${fmt(a.s1P95MedianMs, 2)} ms | ${fmt(a.s1P99MedianMs, 2)} ms | ${fmt(a.s1RpsMedian, 0)} | ${a.s1Errors} | ${fmt(a.s2P95MedianMs, 2)} ms | ${a.s2Errors} | ${fmt(a.coldApiMedianMs, 0)} ms | ${fmt(a.coldRadarMedianMs, 0)} ms |`);
  }
  console.log(`\nSobrecarga p95 del proxy en S1: ${fmt(overheadPct)} %`);
  console.log(`Diagnóstico S3 (${cfg.s3PerSecond} solicitudes/s): p95 local ${fmt(agg.local.s3P95MedianMs, 2)} ms, proxy ${fmt(agg.proxy.s3P95MedianMs, 2)} ms, sobrecarga ${fmt(s3OverheadPct)} %, errores ${agg.local.s3Errors + agg.proxy.s3Errors}`);
  for (const v of verdicts) console.log(`${v.pass ? 'CUMPLE   ' : 'NO CUMPLE'} ${v.criterion}`);
  console.log(`\nResultados: ${path.relative(st.ROOT, file)}`);
}

main().catch((e) => {
  console.error(e);
  infra.removeContainers();
  process.exit(1);
});
