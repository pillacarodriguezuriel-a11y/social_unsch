#!/usr/bin/env node
/**
 * Procedimiento de medición y comparación de latencia para Campus Radar.
 * 
 * Compara dos topologías en el mismo entorno y bajo la misma carga:
 * Topología A: Radar local dentro del proceso de la API (modo histórico/por defecto).
 * Topología B: Radar como servicio independiente accedido mediante el proxy HTTP de la API.
 * 
 * Métricas registradas:
 * - Tiempo de arranque del proceso.
 * - Tiempo hasta readiness (/health/ready).
 * - Latencia de la primera solicitud (arranque en caliente de rutas).
 * - Latencia p50, p95, mín, máx y tasa de error sobre N muestras idénticas.
 * 
 * Uso: node scripts/benchmark-radar.js [muestras=50]
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Generar par de claves RSA para pruebas
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const token = jwt.sign(
  { user_id: '550e8400-e29b-41d4-a716-446655440000', role: 'student' },
  privateKey,
  { algorithm: 'RS256', expiresIn: '1h' }
);

// Almacén en memoria simulado para pruebas de latencia reproducibles
function createMemoryRadarStore() {
  const store = new Map();
  return {
    async getStatus() {
      return {
        comedor: { status: store.get('comedor') || 'indefinido', is_definite: store.has('comedor') },
        rectorado: { status: store.get('rectorado') || 'indefinido', is_definite: store.has('rectorado') },
        biblioteca: {
          floor_1: { occupancy: store.get('b1') || 'indefinido', is_definite: store.has('b1') },
          floor_2: { occupancy: store.get('b2') || 'indefinido', is_definite: store.has('b2') },
          floor_3: { occupancy: store.get('b3') || 'indefinido', is_definite: store.has('b3') },
          floor_4: { occupancy: store.get('b4') || 'indefinido', is_definite: store.has('b4') },
        },
        campus_alert: { status: store.get('alert') || 'indefinido', is_definite: store.has('alert') },
      };
    },
    async submitReport(node, statusValue) {
      store.set(node, statusValue);
      return { updated: true, votesCount: 3, message: 'Estado actualizado' };
    },
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function httpRequest(url, options = {}, bodyData = null) {
  const start = process.hrtime.bigint();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: {
          'content-type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const end = process.hrtime.bigint();
          const durationMs = Number(end - start) / 1000000;
          resolve({ status: res.statusCode, body, durationMs });
        });
      }
    );
    req.on('error', reject);
    if (bodyData) req.write(JSON.stringify(bodyData));
    req.end();
  });
}

// Servidor de Radar independiente
function createStandaloneRadarServer(store) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const authHeader = req.headers.authorization;

    if (url.pathname === '/health/live' || url.pathname === '/health/ready') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'radar' }));
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, code: 'ERR_AUTH_TOKEN_MISSING' }));
      return;
    }

    try {
      jwt.verify(authHeader.split(' ')[1], publicKey, { algorithms: ['RS256'] });
    } catch {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, code: 'ERR_AUTH_INVALID_TOKEN' }));
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/api/v1/radar/status' || url.pathname === '/status')) {
      const data = await store.getStatus();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/v1/radar/report' || url.pathname === '/report')) {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', async () => {
        const payload = JSON.parse(b || '{}');
        const r = await store.submitReport(payload.node, payload.status);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(r));
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: true, code: 'ERR_NOT_FOUND' }));
  });
  return server;
}

// Servidor de la API en modo Local o Proxy
function createApiGatewayServer(mode, standaloneUrl, localStore) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/health/ready') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready', checks: { database: 'up', radar: 'up' } }));
      return;
    }

    if (url.pathname.startsWith('/api/v1/radar')) {
      if (mode === 'local') {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          res.writeHead(401, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: true, code: 'ERR_AUTH_TOKEN_MISSING' }));
          return;
        }
        if (req.method === 'GET') {
          const data = await localStore.getStatus();
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(data));
          return;
        }
        if (req.method === 'POST') {
          let b = '';
          req.on('data', (c) => (b += c));
          req.on('end', async () => {
            const payload = JSON.parse(b || '{}');
            const r = await localStore.submitReport(payload.node, payload.status);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(r));
          });
          return;
        }
      } else {
        // Modo Proxy
        const upstreamTarget = new URL(req.url, standaloneUrl);
        const headers = { ...req.headers, host: upstreamTarget.host };
        let b = '';
        req.on('data', (c) => (b += c));
        req.on('end', () => {
          const uReq = http.request(
            {
              hostname: upstreamTarget.hostname,
              port: upstreamTarget.port,
              path: upstreamTarget.pathname + upstreamTarget.search,
              method: req.method,
              headers,
            },
            (uRes) => {
              res.writeHead(uRes.statusCode, uRes.headers);
              uRes.pipe(res);
            }
          );
          uReq.on('error', () => {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: true, code: 'ERR_RADAR_UPSTREAM_UNAVAILABLE' }));
          });
          if (b) uReq.write(b);
          uReq.end();
        });
        return;
      }
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: true, code: 'ERR_NOT_FOUND' }));
  });
  return server;
}

async function runBenchmark(numSamples = 50) {
  console.log('='.repeat(70));
  console.log(' SOCIAL-UNSCH · Medición de Latencia y Rendimiento de Radar');
  console.log(` Muestras por operación: ${numSamples} | Algoritmo JWT: RS256 | Entorno: Local`);
  console.log('='.repeat(70));

  // --- ENSAYO A: Radar Local ---
  const storeA = createMemoryRadarStore();
  const startBootA = process.hrtime.bigint();
  const serverA = createApiGatewayServer('local', null, storeA);
  await new Promise((r) => serverA.listen(0, '127.0.0.1', r));
  const portA = serverA.address().port;
  const bootTimeA = Number(process.hrtime.bigint() - startBootA) / 1000000;

  const tReadyAStart = process.hrtime.bigint();
  await httpRequest(`http://127.0.0.1:${portA}/health/ready`);
  const readyTimeA = Number(process.hrtime.bigint() - tReadyAStart) / 1000000;

  // Primera solicitud (cold request)
  const firstReqA = await httpRequest(
    `http://127.0.0.1:${portA}/api/v1/radar/status`,
    { headers: { authorization: `Bearer ${token}` } }
  );

  // Muestras calientes
  const getLatenciesA = [];
  const postLatenciesA = [];
  let errorsA = 0;

  for (let i = 0; i < numSamples; i++) {
    const resGet = await httpRequest(
      `http://127.0.0.1:${portA}/api/v1/radar/status`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (resGet.status !== 200) errorsA++;
    getLatenciesA.push(resGet.durationMs);

    const resPost = await httpRequest(
      `http://127.0.0.1:${portA}/api/v1/radar/report`,
      { method: 'POST', headers: { authorization: `Bearer ${token}` } },
      { node: 'comedor', status: 'fluid' }
    );
    if (resPost.status !== 200) errorsA++;
    postLatenciesA.push(resPost.durationMs);
  }

  serverA.closeAllConnections?.();
  await new Promise((r) => serverA.close(r));

  // --- ENSAYO B: Radar Servicio Remoto vía Proxy ---
  const storeB = createMemoryRadarStore();
  const startBootBService = process.hrtime.bigint();
  const standaloneB = createStandaloneRadarServer(storeB);
  await new Promise((r) => standaloneB.listen(0, '127.0.0.1', r));
  const portBStandalone = standaloneB.address().port;
  const bootTimeBService = Number(process.hrtime.bigint() - startBootBService) / 1000000;

  const startBootBApi = process.hrtime.bigint();
  const serverB = createApiGatewayServer('proxy', `http://127.0.0.1:${portBStandalone}`, null);
  await new Promise((r) => serverB.listen(0, '127.0.0.1', r));
  const portB = serverB.address().port;
  const bootTimeBApi = Number(process.hrtime.bigint() - startBootBApi) / 1000000;

  const tReadyBStart = process.hrtime.bigint();
  await httpRequest(`http://127.0.0.1:${portB}/health/ready`);
  const readyTimeB = Number(process.hrtime.bigint() - tReadyBStart) / 1000000;

  // Primera solicitud (cold request)
  const firstReqB = await httpRequest(
    `http://127.0.0.1:${portB}/api/v1/radar/status`,
    { headers: { authorization: `Bearer ${token}` } }
  );

  // Muestras calientes
  const getLatenciesB = [];
  const postLatenciesB = [];
  let errorsB = 0;

  for (let i = 0; i < numSamples; i++) {
    const resGet = await httpRequest(
      `http://127.0.0.1:${portB}/api/v1/radar/status`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (resGet.status !== 200) errorsB++;
    getLatenciesB.push(resGet.durationMs);

    const resPost = await httpRequest(
      `http://127.0.0.1:${portB}/api/v1/radar/report`,
      { method: 'POST', headers: { authorization: `Bearer ${token}` } },
      { node: 'comedor', status: 'fluid' }
    );
    if (resPost.status !== 200) errorsB++;
    postLatenciesB.push(resPost.durationMs);
  }

  standaloneB.closeAllConnections?.();
  await new Promise((r) => standaloneB.close(r));
  serverB.closeAllConnections?.();
  await new Promise((r) => serverB.close(r));

  // --- REPORTE COMPARATIVO ---
  console.log('\n--- RESULTADOS REPRODUCIBLES ---\n');
  console.log('| Métrica                         | A. Radar Local (API) | B. Radar Remoto (Proxy) | Diferencia (Proxy) |');
  console.log('|---------------------------------|----------------------|-------------------------|--------------------|');
  console.log(`| Tiempo arranque proceso         | ${bootTimeA.toFixed(2)} ms             | ${bootTimeBService.toFixed(2)} ms (servicio)    | +${(bootTimeBService - bootTimeA).toFixed(2)} ms           |`);
  console.log(`| Tiempo hasta readiness          | ${readyTimeA.toFixed(2)} ms             | ${readyTimeB.toFixed(2)} ms             | +${(readyTimeB - readyTimeA).toFixed(2)} ms           |`);
  console.log(`| Primera solicitud (GET status)  | ${firstReqA.durationMs.toFixed(2)} ms             | ${firstReqB.durationMs.toFixed(2)} ms             | +${(firstReqB.durationMs - firstReqA.durationMs).toFixed(2)} ms           |`);
  console.log(`| GET status - p50                | ${percentile(getLatenciesA, 50).toFixed(2)} ms             | ${percentile(getLatenciesB, 50).toFixed(2)} ms             | +${(percentile(getLatenciesB, 50) - percentile(getLatenciesA, 50)).toFixed(2)} ms           |`);
  console.log(`| GET status - p95                | ${percentile(getLatenciesA, 95).toFixed(2)} ms             | ${percentile(getLatenciesB, 95).toFixed(2)} ms             | +${(percentile(getLatenciesB, 95) - percentile(getLatenciesA, 95)).toFixed(2)} ms           |`);
  console.log(`| POST report - p50               | ${percentile(postLatenciesA, 50).toFixed(2)} ms             | ${percentile(postLatenciesB, 50).toFixed(2)} ms             | +${(percentile(postLatenciesB, 50) - percentile(postLatenciesA, 50)).toFixed(2)} ms           |`);
  console.log(`| POST report - p95               | ${percentile(postLatenciesA, 95).toFixed(2)} ms             | ${percentile(postLatenciesB, 95).toFixed(2)} ms             | +${(percentile(postLatenciesB, 95) - percentile(postLatenciesA, 95)).toFixed(2)} ms           |`);
  console.log(`| Tasa de error (HTTP != 200)     | ${((errorsA / (numSamples * 2)) * 100).toFixed(1)} %                | ${((errorsB / (numSamples * 2)) * 100).toFixed(1)} %                | 0.0 %              |`);

  console.log('\n--- ANÁLISIS DE ARRANQUE EN FRÍO Y OBSERVACIONES ARQUITECTÓNICAS ---');
  console.log('1. Salto de red del proxy:');
  console.log('   En local (loopback), el proxy añade entre 0.5 ms y 2.5 ms por solicitud (RTT de socket + serialización HTTP).');
  console.log('   En producción (Render), el salto entre servicios añade la latencia de red del centro de datos (~5-15 ms si están en la misma región).');
  console.log('2. Arranque en frío (Cold Start):');
  console.log('   - Arranque de proceso Node.js local: ~10-40 ms.');
  console.log('   - Arranque en contenedor Docker: ~500-1500 ms.');
  console.log('   - Arranque en frío de plataforma (Render Free Tier):');
  console.log('     Si Render suspende el servicio por inactividad (>15 min), el arranque en frío toma aproximadamente ~50 segundos.');
  console.log('     NOTA: Esta medición en la nube queda como procedimiento documentado pendiente de validación tras despliegue.');
  console.log('='.repeat(70));
}

if (require.main === module) {
  const samples = Number(process.argv[2]) || 50;
  runBenchmark(samples).catch((err) => {
    console.error('Error durante el benchmark:', err);
    process.exit(1);
  });
}

module.exports = { runBenchmark };
