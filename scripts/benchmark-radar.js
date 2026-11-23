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
const { execFile } = require('child_process');
const { monitorEventLoopDelay } = require('perf_hooks');
const { RadarStatusResponseSchema, RadarReportResponseSchema } = require('@social-unsch/contracts');
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
for (const [key, value] of Object.entries(cfg)) if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuración inválida: ${key}`);
if (!Number.isInteger(cfg.reps) || cfg.reps < 3 || cfg.users !== 50 || cfg.s1Seconds < 30 || cfg.s1WarmupSeconds < 10 || cfg.s2PerMinute !== 100 || cfg.s2Seconds !== 60) throw new Error('La aceptación exige >=3 repeticiones, 50 usuarios, >=30s, >=10s de calentamiento y 100 reportes/60s');
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

const { percentile, median } = require('./lib/measurement');

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
    const body = await res.json().catch(() => null);
    const valid = (url.endsWith(REPORT) ? RadarReportResponseSchema : RadarStatusResponseSchema).safeParse(body).success;
    return { ok: res.status === 200 && valid, updated: body?.updated === true, status: res.status, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
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

async function openLoop(base, perMinute, seconds) {
  const interval = 60000 / perMinute;
  const total = Math.round((seconds * 1000) / interval);
  const pending = [];
  // Firmar fuera de la ventana medida: el generador no compite haciendo RSA por cada envío.
  const tokens = Array.from({length: total}, () => token(`bench-report-${++reportSeq}`));
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    const wait = start + i * interval - Date.now();
    if (wait > 0) await st.sleep(wait);
    const node = 'comedor', status = 'fluid';
    pending.push(timed(base + REPORT, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens[i]}`, 'content-type': 'application/json' },
      body: JSON.stringify({ node, status }),
    }));
  }
  const samples = await Promise.all(pending);
  await st.sleep(Math.max(0, start + seconds * 1000 - Date.now()));
  return samples;
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
  const samples = await Promise.all(pending);
  await st.sleep(Math.max(0, start + seconds * 1000 - Date.now()));
  return samples;
}

async function startMode(mode) {
  const PORTS = { api: BASE_PORTS.api + portOffset, radar: BASE_PORTS.radar + portOffset };
  portOffset++;
  const procs = [];
  const cold = {};
  if (mode === 'proxy') {
    const radar = st.radarProcess({ port: PORTS.radar, redisUrl: infra.redisUrl, keys });
    radar.preload = path.join(__dirname, 'lib', 'bench-telemetry.js');
    cold.radarMs = await radar.start({ readyPath: '/health/ready' });
    procs.push(radar);
  }
  const api = st.apiProcess({
    port: PORTS.api, databaseUrl: infra.databaseUrl, redisUrl: infra.redisUrl, keys,
    radarMode: mode, radarTarget: mode === 'proxy' ? `http://127.0.0.1:${PORTS.radar}` : undefined,
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
  const loop = monitorEventLoopDelay({ resolution: 10 }); loop.enable();
  const containers = [];
  let pending = null;
  const poll = () => {
    if (pending) return;
    pending = new Promise(resolve => execFile('docker', ['stats','--no-stream','--format','{{.Name}};{{.CPUPerc}};{{.MemUsage}}',infra.pgName,infra.redisName], {timeout:5000}, (error, out) => {
      containers.push({at: new Date().toISOString(), stats: error ? null : out.trim().split('\n')}); resolve();
    })).finally(() => {pending=null;});
  };
  const timer = setInterval(poll,5000);
  let samples;
  try { samples = await run(); } finally {clearInterval(timer); loop.disable();}
  const end = Date.now(), seconds = (end-started)/1000, used=process.cpuUsage(cpu);
  const generator = {cpuPctOfOneCore:(used.user+used.system)/seconds/10000,rssMb:process.memoryUsage().rss/1048576,eventLoopP95Ms:loop.percentile(95)/1e6,eventLoopMaxMs:loop.max/1e6};
  if (pending) await pending;
  return {samples, ...summarize(samples,seconds),durationS:seconds,generator,containers,usage:procs.map(p=>({name:p.name,samples:p.telemetry.filter(x=>x.at>=started && x.at<=end)}))};
}

async function runRep(mode, rep) {
  const { api, procs, cold } = await startMode(mode);
  try {
    await seed(api.url);
    await closedLoop(api.url, cfg.s1WarmupSeconds);
    const s1 = await measure(procs, () => closedLoop(api.url, cfg.s1Seconds));

    await seed(api.url);
    infra.flushRedis();
    const s2 = await measure(procs, () => openLoop(api.url, cfg.s2PerMinute, cfg.s2Seconds));
    const updates = s2.samples.filter(s=>s.updated).length;
    const remainingRaw = infra.redisCli('SCARD','radar:comedor:reports:fluid');
    const remaining = remainingRaw === null ? null : Number(remainingRaw);
    s2.integrity = {updates, remaining, expectedUpdates:33, expectedRemaining:1, pass:s2.ok===100 && updates===33 && remaining===1 && infra.redisCli('HGET','radar:comedor:status','status') === 'fluid'};

    await seed(api.url);
    await openLoopStatus(api.url, cfg.s3PerSecond, 10);
    const s3 = await measure(procs, () => openLoopStatus(api.url, cfg.s3PerSecond, cfg.s3Seconds));
    for (const s of [s1,s2,s3]) delete s.samples;

    return {
      mode, rep, cold,
      s1: { ...s1, users: cfg.users },
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
    commit: safe(() => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: st.ROOT }).toString().trim()),
    dirty: safe(() => execFileSync('git', ['status', '--porcelain', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'], { cwd: st.ROOT }).toString().trim() !== ''),
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    cpu: `${os.cpus()[0].model} × ${os.cpus().length}`,
    memoryGb: Number((os.totalmem() / 1073741824).toFixed(1)),
    docker: safe(() => execFileSync('docker', ['version', '--format', '{{.Server.Version}}']).toString().trim()),
    images: ['postgres:16-alpine', 'redis:7-alpine'],
    config: cfg,
    foreignContainers: safe(() => execFileSync('docker',['ps','--format','{{.Names}}']).toString().trim().split('\n').filter(x=>!x.startsWith('social_unsch_')).length),
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
    ['S1 p95 < 500 ms con 50 usuarios, modo local', byMode('local').every(r => r.s1.p95 < THRESHOLDS.s1P95Ms && r.s1.ok === r.s1.requests)],
    ['S1 p95 < 500 ms con 50 usuarios, modo proxy', byMode('proxy').every(r => r.s1.p95 < THRESHOLDS.s1P95Ms && r.s1.ok === r.s1.requests)],
    ['S1 sobrecarga p95 del proxy ≤ 20 %', overheadPct <= THRESHOLDS.overheadP95Pct],
    ['S2 100 reportes/min sin errores ni pérdida de votos, ambos modos', results.every(r=>r.s2.integrity.pass)],
    ['S2 p95 < 500 ms, ambos modos', agg.local.s2P95MedianMs < THRESHOLDS.s2P95Ms && agg.proxy.s2P95MedianMs < THRESHOLDS.s2P95Ms],
  ].map(([criterion, pass]) => ({ criterion, pass }));

  const pairs = Array.from({length:cfg.reps},(_,i)=>{const a=results.find(r=>r.rep===i+1&&r.mode==='local').s1.p95,b=results.find(r=>r.rep===i+1&&r.mode==='proxy').s1.p95;return {rep:i+1,localP95:a,proxyP95:b,additionalMs:b-a,overheadPct:(b-a)/a*100,pass:(b-a)/a*100<=20};});
  const out = { environment: env, thresholds: THRESHOLDS, aggregate: agg, overheadP95Pct: overheadPct, additionalP95Ms:agg.proxy.s1P95MedianMs-agg.local.s1P95MedianMs, pairs, diagnosticS3OverheadP95Pct: s3OverheadPct, verdicts, runs: results };
  const file = process.env.BENCH_OUT || path.join(st.ROOT, 'docs', 'migracion', 'evidencias', `benchmark-radar-${env.date.slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', { flag:'wx' });

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
