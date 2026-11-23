'use strict';
/**
 * Pruebas de extremo a extremo de la separación de Radar con infraestructura real.
 *
 *   cliente → apps/api compilada (RADAR_MODE=proxy) → apps/radar compilada → Redis real
 *   cliente → apps/api compilada (RADAR_MODE=local) → Redis real          (paridad)
 *   PostgreSQL real para los flujos de la API ajenos a Radar.
 *
 * Requiere Docker. Los contenedores usan el prefijo social_unsch_e2e_ y se eliminan al terminar,
 * también si la suite falla. Uso: npm run test:e2e
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const {
  RadarStatusResponseSchema, RadarReportResponseSchema, ErrorResponseSchema, RADAR_ERROR_CODES,
} = require('@social-unsch/contracts');
const st = require('../../scripts/lib/radar-stack');

const PORTS = { apiProxy: 3410, apiLocal: 3420, apiBlackHole: 3430, radar: 4410, blackHole: 4499 };
const PROXY_TIMEOUT_MS = 4000;
const STATUS = '/api/v1/radar/status';
const REPORT = '/api/v1/radar/report';

const infra = new st.Infra();
const keys = st.generateKeys();
const otherKeys = st.generateKeys();
let radar, apiProxy, apiLocal, apiBlackHole, blackHole;
let userToken; // token emitido por la API real tras registro e inicio de sesión

const sign = (userId, opts = {}, key = keys.privateKey) =>
  jwt.sign({ user_id: userId, role: 'student' }, key, { algorithm: 'RS256', expiresIn: '1h', ...opts });
const auth = (token, extra = {}) => ({ authorization: `Bearer ${token}`, ...extra });

async function call(base, p, { method = 'GET', headers = {}, body } = {}) {
  const t0 = Date.now();
  const res = await fetch(base + p, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* cuerpo no JSON */ }
  return { status: res.status, body: json, ms: Date.now() - t0 };
}

const report = (base, token, node, status, headers = {}) =>
  call(base, REPORT, { method: 'POST', headers: auth(token, headers), body: { node, status } });

function assertError(res, status, code) {
  assert.equal(res.status, status, `estado esperado ${status}, recibido ${res.status}: ${JSON.stringify(res.body)}`);
  ErrorResponseSchema.parse(res.body);
  assert.equal(res.body.code, code);
}

before(async () => {
  await infra.start();
  infra.migrate();
  radar = st.radarProcess({ port: PORTS.radar, redisUrl: infra.redisUrl, keys });
  await radar.start({ readyPath: '/health/ready' });
  const common = { databaseUrl: infra.databaseUrl, redisUrl: infra.redisUrl, keys };
  apiProxy = st.apiProcess({ ...common, port: PORTS.apiProxy, radarMode: 'proxy', radarTarget: radar.url, radarTimeoutMs: PROXY_TIMEOUT_MS });
  apiLocal = st.apiProcess({ ...common, port: PORTS.apiLocal, radarMode: 'local' });
  await apiProxy.start({ readyPath: '/health/ready' });
  await apiLocal.start({ readyPath: '/health/ready' });

  // Identidad real: registro e inicio de sesión contra PostgreSQL.
  const email = `e2e.radar.${Date.now()}@unsch.edu.pe`;
  const password = 'Prueba#E2e2026';
  const reg = await call(apiProxy.url, '/api/v1/auth/register', {
    method: 'POST', body: { full_name: 'Usuario Prueba Radar', email, password, role: 'student' },
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const login = await call(apiProxy.url, '/api/v1/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  userToken = login.body.access_token;
}, { timeout: 240000 });

after(async () => {
  for (const p of [apiBlackHole, apiLocal, apiProxy, radar]) if (p) await p.stop().catch(() => undefined);
  if (blackHole) await blackHole.close();
  infra.removeContainers();
}, { timeout: 60000 });

test('1. la consulta válida atraviesa API → Radar → Redis y cumple el contrato', async () => {
  infra.flushRedis();
  const res = await call(apiProxy.url, STATUS, { headers: auth(userToken, { 'x-request-id': 'e2e-trazabilidad-1' }) });
  assert.equal(res.status, 200);
  RadarStatusResponseSchema.parse(res.body);
  // Los registros se escriben al terminar la respuesta: se esperan en lugar de leerlos de inmediato.
  await st.waitFor(() => radar.logs.some((l) => l.includes('e2e-trazabilidad-1')), { label: 'registro de Radar con x-request-id', timeoutMs: 3000 });
  await st.waitFor(() => apiProxy.logs.some((l) => l.includes('e2e-trazabilidad-1')), { label: 'registro de la API con x-request-id', timeoutMs: 3000 });
});

test('2. un reporte válido se registra en Redis a través del proxy', async () => {
  infra.flushRedis();
  const res = await report(apiProxy.url, userToken, 'comedor', 'fluid');
  assert.equal(res.status, 200);
  RadarReportResponseSchema.parse(res.body);
  assert.equal(res.body.updated, false);
  assert.equal(res.body.votes_current, 1);
  assert.equal(infra.redisCli('SCARD', 'radar:comedor:reports:fluid'), '1');
});

test('3. las entradas inválidas se rechazan con los mismos códigos en modo proxy y local', async () => {
  const cases = [
    [{ node: 'piscina', status: 'fluid' }, 400, 'ERR_RADAR_INVALID_NODE'],
    [{ node: 'comedor', status: 'lleno' }, 400, 'ERR_RADAR_INVALID_STATUS'],
    [{ node: 'biblioteca_floor_2', status: '101' }, 400, 'ERR_RADAR_INVALID_STATUS'],
    [{ node: 'rectorado' }, 400, 'ERR_VALIDATION_INVALID_FIELDS'],
    [{}, 400, 'ERR_VALIDATION_INVALID_FIELDS'],
  ];
  for (const [body, status, code] of cases) {
    for (const base of [apiProxy.url, apiLocal.url]) {
      const res = await call(base, REPORT, { method: 'POST', headers: auth(userToken), body });
      assertError(res, status, code);
      assert.equal(RADAR_ERROR_CODES[code], status);
    }
  }
});

test('4. tokens ausentes, alterados, expirados o de otra clave se rechazan al 100 %', async () => {
  const valid = sign('e2e-token-user');
  const altered = valid.slice(0, -3) + (valid.endsWith('AAA') ? 'BBB' : 'AAA');
  const expired = jwt.sign({ user_id: 'e2e-token-user', exp: Math.floor(Date.now() / 1000) - 60 }, keys.privateKey, { algorithm: 'RS256' });
  const foreign = sign('e2e-token-user', {}, otherKeys.privateKey);
  const cases = [
    [{}, 'ERR_AUTH_TOKEN_MISSING'],
    [{ authorization: 'Token abc' }, 'ERR_AUTH_INVALID_TOKEN'],
    [auth(altered), 'ERR_AUTH_INVALID_TOKEN'],
    [auth(expired), 'ERR_AUTH_TOKEN_EXPIRED'],
    [auth(foreign), 'ERR_AUTH_INVALID_TOKEN'],
  ];
  let attempts = 0, rejected = 0;
  for (const [headers, code] of cases) {
    for (const base of [apiProxy.url, apiLocal.url, radar.url]) {
      for (const [method, p] of [['GET', STATUS], ['POST', REPORT]]) {
        attempts++;
        const res = await call(base, p, { method, headers, body: method === 'POST' ? { node: 'comedor', status: 'fluid' } : undefined });
        assertError(res, 401, code);
        rejected++;
      }
    }
  }
  assert.equal(rejected, attempts);
});

test('5. Radar ignora identidades falsificadas en cabeceras', async () => {
  infra.flushRedis();
  const noToken = await call(radar.url, REPORT, {
    method: 'POST', headers: { 'x-user-id': 'e2e-falso', 'x-role': 'administrator' }, body: { node: 'rectorado', status: 'collapsed' },
  });
  assertError(noToken, 401, 'ERR_AUTH_TOKEN_MISSING');
  const spoof = await report(radar.url, sign('e2e-real-a'), 'rectorado', 'collapsed', { 'x-user-id': 'e2e-falso-b' });
  assert.equal(spoof.status, 200);
  assert.equal(infra.redisCli('SMEMBERS', 'radar:rectorado:reports:collapsed'), 'e2e-real-a');
});

test('6. un voto repetido en la ventana se cuenta una sola vez', async () => {
  infra.flushRedis();
  const token = sign('e2e-duplicado');
  const first = await report(apiProxy.url, token, 'campus_alert', 'cultural_event');
  const second = await report(apiProxy.url, token, 'campus_alert', 'cultural_event');
  assert.equal(first.body.votes_current, 1);
  assert.equal(second.status, 200);
  assert.equal(second.body.updated, false);
  assert.equal(second.body.votes_current, 0);
  assert.equal(infra.redisCli('SCARD', 'radar:campus_alert:reports:cultural_event'), '1');
});

test('7. votos concurrentes: sin pérdidas y consenso atómico', async () => {
  infra.flushRedis();
  // 40 votos simultáneos: 20 valores de aforo poco comunes con dos votantes cada uno (por debajo del umbral).
  const values = Array.from({ length: 20 }, (_, i) => String(i + 1));
  const reqs = values.flatMap((v) => ['a', 'b'].map((u) => report(apiProxy.url, sign(`e2e-conc-${u}-${v}`), 'biblioteca_floor_1', v)));
  const results = await Promise.all(reqs);
  assert.ok(results.every((r) => r.status === 200), 'todos los votos válidos deben aceptarse');
  for (const v of values) assert.equal(infra.redisCli('SCARD', `radar:biblioteca_floor_1:reports:${v}`), '2', `valor ${v}`);

  // 10 votos simultáneos del mismo estado: el umbral de 3 se alcanza exactamente 3 veces y queda 1 voto.
  const race = await Promise.all(Array.from({ length: 10 }, (_, i) => report(apiProxy.url, sign(`e2e-carrera-${i}`), 'comedor', 'Cerrado')));
  assert.ok(race.every((r) => r.status === 200));
  assert.equal(race.filter((r) => r.body.updated === true).length, 3);
  assert.equal(infra.redisCli('SCARD', 'radar:comedor:reports:Cerrado'), '1');
  assert.equal(infra.redisCli('HGET', 'radar:comedor:status', 'status'), 'Cerrado');
  const status = await call(apiProxy.url, STATUS, { headers: auth(userToken) });
  assert.equal(status.body.comedor.status, 'Cerrado');
  assert.equal(status.body.comedor.is_definite, true);
});

test('8. el proxy corta con 504 cuando el destino no responde, en un tiempo finito', async () => {
  blackHole = await st.blackHoleServer(PORTS.blackHole);
  apiBlackHole = st.apiProcess({
    databaseUrl: infra.databaseUrl, redisUrl: infra.redisUrl, keys, port: PORTS.apiBlackHole,
    radarMode: 'proxy', radarTarget: `http://127.0.0.1:${PORTS.blackHole}`, radarTimeoutMs: 1500,
  });
  await apiBlackHole.start();
  const res = await call(apiBlackHole.url, STATUS, { headers: auth(userToken) });
  assertError(res, 504, 'ERR_RADAR_UPSTREAM_TIMEOUT');
  assert.ok(res.ms >= 1400 && res.ms < 4000, `duración ${res.ms} ms`);
  const ready = await call(apiBlackHole.url, '/health/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'degraded');
  await apiBlackHole.stop();
  await blackHole.close();
  apiBlackHole = blackHole = null;
});

async function assertForeignFlowsWork() {
  const catalogs = await call(apiProxy.url, '/api/v1/catalogs');
  assert.equal(catalogs.status, 200);
  assert.ok(catalogs.body.data.schools.length > 0);
  const feed = await call(apiProxy.url, '/api/v1/feed', { headers: auth(userToken) });
  assert.equal(feed.status, 200);
  const post = await call(apiProxy.url, '/api/v1/feed', { method: 'POST', headers: auth(userToken), body: { content: 'Publicación E2E de aislamiento' } });
  assert.equal(post.status, 201);
  const me = await call(apiProxy.url, '/api/v1/auth/profile-me', { headers: auth(userToken) });
  assert.equal(me.status, 200);
}

test('9. Radar detenido: errores controlados, resto de la API intacto y recuperación', async () => {
  await radar.stop();
  const get = await call(apiProxy.url, STATUS, { headers: auth(userToken) });
  assertError(get, 502, 'ERR_RADAR_UPSTREAM_UNAVAILABLE');
  assert.ok(get.ms < 2000, `502 en ${get.ms} ms`);
  const post = await report(apiProxy.url, userToken, 'comedor', 'fluid');
  assertError(post, 502, 'ERR_RADAR_UPSTREAM_UNAVAILABLE');
  await assertForeignFlowsWork();
  const ready = await call(apiProxy.url, '/health/ready');
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'degraded', checks: { database: 'up', radar: 'down' } });

  await radar.start({ readyPath: '/health/ready' });
  const again = await call(apiProxy.url, STATUS, { headers: auth(userToken) });
  assert.equal(again.status, 200);
  assert.equal((await call(apiProxy.url, '/health/ready')).body.status, 'ready');
});

test('10. Redis detenido: Radar falla de forma controlada y se recupera al volver', async () => {
  infra.stopRedis();
  try {
    for (const base of [apiProxy.url, apiLocal.url, radar.url]) {
      const res = await call(base, STATUS, { headers: auth(userToken) });
      assertError(res, 500, 'ERR_SERVER_INTERNAL_ERROR');
      assert.ok(res.ms < 3000, `${base}: ${res.ms} ms`);
      const post = await report(base, sign('e2e-redis-caido'), 'comedor', 'fluid');
      assertError(post, 500, 'ERR_SERVER_INTERNAL_ERROR');
    }
    assert.equal((await call(radar.url, '/health/ready')).status, 503);
    for (const api of [apiProxy, apiLocal]) {
      const ready = await call(api.url, '/health/ready');
      assert.deepEqual(ready.body, { status: 'degraded', checks: { database: 'up', radar: 'down' } });
    }
    await assertForeignFlowsWork();
  } finally {
    infra.startRedis();
  }
  await infra.waitRedisUp();
  for (const base of [apiProxy.url, apiLocal.url]) {
    await st.waitFor(async () => (await call(base, STATUS, { headers: auth(userToken) })).status === 200,
      { label: `recuperación de ${base}`, timeoutMs: 20000, intervalMs: 250 });
  }
});

test('11. Redis sin respuesta (pausado): ninguna solicitud queda pendiente indefinidamente', async () => {
  infra.pauseRedis();
  try {
    for (const base of [radar.url, apiLocal.url, apiProxy.url]) {
      const res = await call(base, STATUS, { headers: auth(userToken) });
      assertError(res, 500, 'ERR_SERVER_INTERNAL_ERROR');
      assert.ok(res.ms < PROXY_TIMEOUT_MS, `${base}: ${res.ms} ms`);
    }
  } finally {
    infra.unpauseRedis();
  }
  await st.waitFor(async () => (await call(apiProxy.url, STATUS, { headers: auth(userToken) })).status === 200,
    { label: 'recuperación tras reanudar Redis', timeoutMs: 20000 });
});

test('12. PostgreSQL detenido: la salud lo marca como caída crítica y Radar sigue atendiendo', async () => {
  infra.stopPostgres();
  try {
    const ready = await call(apiProxy.url, '/health/ready');
    assert.equal(ready.status, 503);
    assert.deepEqual(ready.body, { status: 'unavailable', checks: { database: 'down', radar: 'up' } });
    const radarRes = await call(apiProxy.url, STATUS, { headers: auth(userToken) });
    assert.equal(radarRes.status, 200);
    const catalogs = await call(apiProxy.url, '/api/v1/catalogs');
    assertError(catalogs, 500, 'ERR_SERVER_INTERNAL_ERROR');
    assert.ok(catalogs.ms < 5000, `catálogos en ${catalogs.ms} ms`);
  } finally {
    infra.startPostgres();
  }
  await infra.waitPostgresUp();
  await st.waitFor(async () => (await call(apiProxy.url, '/health/ready')).body?.status === 'ready',
    { label: 'recuperación de PostgreSQL', timeoutMs: 30000, intervalMs: 500 });
  await assertForeignFlowsWork();
});

test('13. la web solo conoce la URL pública de la API, no la dirección de Radar', () => {
  const webDir = path.join(st.ROOT, 'apps', 'web');
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', 'tests'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|js)$/.test(e.name) && /RADAR_PROXY_TARGET|:4001|social-unsch-radar/.test(fs.readFileSync(p, 'utf8'))) offenders.push(p);
    }
  };
  walk(webDir);
  assert.deepEqual(offenders, []);
});

test('14. los procesos terminan al recibir la señal de parada', async () => {
  for (const p of [apiLocal, apiProxy, radar]) {
    const result = await p.stop();
    assert.ok(result && !result.forced, `${p.name} no terminó a tiempo`);
  }
});
