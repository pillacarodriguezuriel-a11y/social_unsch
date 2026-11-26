'use strict';
/**
 * Pruebas de extremo a extremo del servicio Feed y la matriz de modos con infraestructura real.
 *
 *   cliente → apps/api compilada (FEED_MODE=proxy) → apps/feed compilada → PostgreSQL real
 *   cliente → apps/api compilada (FEED_MODE=local) → PostgreSQL real (paridad y reversión)
 *   cliente → apps/api compilada (RADAR_MODE=proxy, FEED_MODE=proxy) → apps/radar + apps/feed
 *
 * Cubre:
 *   - Salud y trazabilidad (x-request-id en registros de API y Feed)
 *   - Autenticación RS256: ausente, malformado, otra clave, expirado, spoofing x-user-id
 *   - Contratos compartidos (@social-unsch/contracts) en GET y POST, filtros, paginación y XSS
 *   - Paridad proxy ↔ local y concurrencia de escrituras (sin pérdidas ni duplicados)
 *   - Fallos de comunicación (504 timeout y 502 proceso detenido) frente a caída de PostgreSQL compartido (503/500)
 *   - Recuperación y aislamiento de flujos ajenos (catálogos, perfil)
 *   - Permisos mínimos en PostgreSQL desechable (rol dedicado sin escritura a users ni acceso a otras tablas)
 *   - Matriz de modos RADAR_MODE × FEED_MODE (incluyendo proxy/proxy y reversión independiente)
 *   - Cierre ordenado (SIGTERM)
 *
 * Requiere Docker. Contenedores con prefijo social_unsch_e2e_feed_ (eliminados al terminar).
 * Uso: npm run test:e2e:feed
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  FeedListResponseSchema,
  FeedCreateResponseSchema,
  RadarStatusResponseSchema,
  ErrorResponseSchema,
} = require('@social-unsch/contracts');
const {
  FeedInfra,
  feedProcess,
  radarProcess,
  apiProcess,
  blackHoleServer,
  generateKeys,
  waitFor,
} = require('../../scripts/lib/feed-stack');

const PORTS = {
  apiProxy: 3510,
  apiLocal: 3520,
  apiBlackHole: 3530,
  apiBothProxy: 3540,
  feed: 4510,
  feedMinPriv: 4520,
  radar: 4530,
  blackHole: 4599,
};
const PROXY_TIMEOUT_MS = 4000;
const FEED_PATH = '/api/v1/feed';
const RADAR_PATH = '/api/v1/radar/status';

const infra = new FeedInfra();
const keys = generateKeys();
const otherKeys = generateKeys();

let feedSvc, feedMinPriv, radarSvc, apiProxy, apiLocal, apiBlackHole, apiBothProxy, blackHole;
let userToken;
let userId;

const sign = (payload, opts = {}, key = keys.privateKey) =>
  jwt.sign(payload, key, { algorithm: 'RS256', expiresIn: '1h', ...opts });

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
  try { json = JSON.parse(text); } catch { /* cuerpo no-JSON */ }
  return { status: res.status, body: json, ms: Date.now() - t0 };
}

const getFeed = (base, token, params = '', extraHeaders = {}) =>
  call(base, FEED_PATH + params, { headers: auth(token, extraHeaders) });

const createPost = (base, token, body, extraHeaders = {}) =>
  call(base, FEED_PATH, { method: 'POST', headers: auth(token, extraHeaders), body });

function assertError(res, status, code) {
  assert.equal(res.status, status, `estado esperado ${status}, recibido ${res.status}: ${JSON.stringify(res.body)}`);
  ErrorResponseSchema.parse(res.body);
  if (code) assert.equal(res.body.code, code);
}

describe('Feed con infraestructura real y matriz de modos', () => {
  before(async () => {
    await infra.start();
    infra.migrate();

    feedSvc = feedProcess({ port: PORTS.feed, databaseUrl: infra.databaseUrl, keys });
    await feedSvc.start({ readyPath: '/health/ready' });

    apiProxy = apiProcess({
      port: PORTS.apiProxy,
      databaseUrl: infra.databaseUrl,
      keys,
      feedMode: 'proxy',
      feedTarget: feedSvc.url,
      feedTimeoutMs: PROXY_TIMEOUT_MS,
    });
    apiLocal = apiProcess({
      port: PORTS.apiLocal,
      databaseUrl: infra.databaseUrl,
      keys,
      feedMode: 'local',
    });
    await apiProxy.start({ readyPath: '/health/ready' });
    await apiLocal.start({ readyPath: '/health/ready' });

    // Registrar usuario real contra PostgreSQL (full_name admite solo letras y espacios)
    const email = `e2e.feed.${Date.now()}@unsch.edu.pe`;
    const password = 'Prueba#E2e2026';
    const reg = await call(apiProxy.url, '/api/v1/auth/register', {
      method: 'POST',
      body: { full_name: 'Estudiante Feed Extremo', email, password, role: 'student' },
    });
    assert.equal(reg.status, 201, `registro falló: ${JSON.stringify(reg.body)}`);

    const login = await call(apiProxy.url, '/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.status, 200, `login falló: ${JSON.stringify(login.body)}`);
    userToken = login.body.access_token;
    userId = login.body.user?.id;
    assert.ok(userToken, 'login debe devolver access_token');
    assert.ok(userId, 'login debe devolver user.id');
  }, { timeout: 240000 });

  after(async () => {
    for (const p of [apiBothProxy, apiBlackHole, apiLocal, apiProxy, feedMinPriv, feedSvc, radarSvc]) {
      if (p) await p.stop().catch(() => undefined);
    }
    if (blackHole) await blackHole.close();
    infra.removeContainers();
  }, { timeout: 60000 });

  describe('Health checks y trazabilidad', () => {
    test('apps/feed /health/live y /health/ready responden 200 con PostgreSQL activo', async () => {
      const live = await call(feedSvc.url, '/health/live');
      assert.equal(live.status, 200);
      const ready = await call(feedSvc.url, '/health/ready');
      assert.equal(ready.status, 200);
      assert.equal(ready.body?.checks?.database, 'up');
    });

    test('apps/api /health/ready informa database: up y feed: up en modo proxy', async () => {
      const ready = await call(apiProxy.url, '/health/ready');
      assert.equal(ready.status, 200);
      assert.equal(ready.body?.checks?.database, 'up');
      assert.equal(ready.body?.checks?.feed, 'up');
    });

    test('x-request-id se propaga de la API a los registros de apps/feed', async () => {
      const traceId = 'e2e-feed-trazabilidad-1';
      const res = await getFeed(apiProxy.url, userToken, '', { 'x-request-id': traceId });
      assert.equal(res.status, 200);
      FeedListResponseSchema.parse(res.body);
      await waitFor(() => feedSvc.logs.some((l) => l.includes(traceId)), { label: 'log Feed con x-request-id', timeoutMs: 3000 });
      await waitFor(() => apiProxy.logs.some((l) => l.includes(traceId)), { label: 'log API con x-request-id', timeoutMs: 3000 });
    });
  });

  describe('Autenticación (modo proxy y acceso directo)', () => {
    test('GET y POST sin token → 401 ERR_AUTH_TOKEN_MISSING', async () => {
      assertError(await call(apiProxy.url, FEED_PATH), 401, 'ERR_AUTH_TOKEN_MISSING');
      assertError(await call(apiProxy.url, FEED_PATH, { method: 'POST', body: { content: 'hola' } }), 401, 'ERR_AUTH_TOKEN_MISSING');
      assertError(await call(feedSvc.url, FEED_PATH), 401, 'ERR_AUTH_TOKEN_MISSING');
    });

    test('tokens de otra clave, expirados o malformados → 401 del contrato', async () => {
      const foreign = sign({ user_id: userId, role: 'student' }, {}, otherKeys.privateKey);
      const expired = sign({ user_id: userId, role: 'student' }, { expiresIn: '-1s' });
      assertError(await getFeed(apiProxy.url, foreign), 401, 'ERR_AUTH_INVALID_TOKEN');
      assertError(await getFeed(apiProxy.url, expired), 401, 'ERR_AUTH_TOKEN_EXPIRED');
      assertError(await getFeed(apiProxy.url, 'esto.no.es.un.jwt'), 401, 'ERR_AUTH_INVALID_TOKEN');
    });

    test('apps/feed ignora cabeceras x-user-id falsificadas sin token y con token válido', async () => {
      const noToken = await call(feedSvc.url, FEED_PATH, { headers: { 'x-user-id': 'spoofed-id', 'x-role': 'administrator' } });
      assertError(noToken, 401, 'ERR_AUTH_TOKEN_MISSING');

      const created = await createPost(feedSvc.url, userToken, { content: 'Autor real verificado' }, { 'x-user-id': 'spoofed-id' });
      assert.equal(created.status, 201);
      FeedCreateResponseSchema.parse(created.body);
      const ownerInDb = infra.psql(`SELECT user_id FROM feed_posts WHERE id = '${created.body.post_id}'`);
      assert.equal(ownerInDb, userId);
    });
  });

  describe('Lectura, escritura, contrato y concurrencia (modo proxy)', () => {
    test('GET /feed cumple FeedListResponseSchema, paginación y filtro faculty_id', async () => {
      const list = await getFeed(apiProxy.url, userToken);
      assert.equal(list.status, 200);
      FeedListResponseSchema.parse(list.body);
      assert.ok(list.body.data.length <= 20);

      const limited = await getFeed(apiProxy.url, userToken, '?page=1&limit=5');
      assert.equal(limited.status, 200);
      FeedListResponseSchema.parse(limited.body);
      assert.ok(limited.body.data.length <= 5);

      const empty = await getFeed(apiProxy.url, userToken, '?faculty_id=99999');
      assert.equal(empty.status, 200);
      FeedListResponseSchema.parse(empty.body);
      assert.deepEqual(empty.body.data, []);

      const badQuery = await getFeed(apiProxy.url, userToken, '?faculty_id=abc');
      assertError(badQuery, 400, 'ERR_VALIDATION_INVALID_FIELDS');
    });

    test('POST /feed valida entradas, sanitiza XSS y el post aparece en GET', async () => {
      assertError(await createPost(apiProxy.url, userToken, { content: '' }), 400, 'ERR_VALIDATION_INVALID_FIELDS');
      assertError(await createPost(apiProxy.url, userToken, { content: '   ' }), 400, 'ERR_VALIDATION_INVALID_FIELDS');
      assertError(await createPost(apiProxy.url, userToken, { content: 'A'.repeat(2001) }), 400, 'ERR_VALIDATION_INVALID_FIELDS');

      const exact2000 = await createPost(apiProxy.url, userToken, { content: 'A'.repeat(2000) });
      assert.equal(exact2000.status, 201);
      FeedCreateResponseSchema.parse(exact2000.body);

      const xss = await createPost(apiProxy.url, userToken, { content: '<script>alert(1)</script>' });
      assert.equal(xss.status, 201);
      FeedCreateResponseSchema.parse(xss.body);

      const list = await getFeed(apiProxy.url, userToken, '?limit=50');
      assert.equal(list.status, 200);
      FeedListResponseSchema.parse(list.body);
      const found = list.body.data.find((p) => p.id === xss.body.post_id);
      assert.ok(found, 'el post creado debe figurar en el listado');
      assert.ok(!found.content.includes('<script>'), 'XSS debe estar escapado');
      assert.ok(found.content.includes('&lt;script&gt;'));
      assert.equal(found.author_name, 'Estudiante Feed Extremo');
    });

    test('10 escrituras concurrentes a través del proxy persisten sin pérdidas ni IDs duplicados', async () => {
      const before = Number(infra.psql('SELECT count(*) FROM feed_posts'));
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => createPost(apiProxy.url, userToken, { content: `Concurrencia ${i}` }))
      );
      assert.ok(results.every((r) => r.status === 201));
      const ids = new Set(results.map((r) => FeedCreateResponseSchema.parse(r.body).post_id));
      assert.equal(ids.size, 10, 'cada publicación concurrente debe recibir un ID único');
      const after = Number(infra.psql('SELECT count(*) FROM feed_posts'));
      assert.equal(after - before, 10);
    });
  });

  describe('Paridad proxy ↔ local y reversión', () => {
    test('proxy y local producen el mismo contrato en lecturas, escrituras y errores', async () => {
      const content = `Paridad ${Date.now()}`;
      const [proxyCreate, localCreate] = await Promise.all([
        createPost(apiProxy.url, userToken, { content }),
        createPost(apiLocal.url, userToken, { content }),
      ]);
      assert.equal(proxyCreate.status, 201);
      assert.equal(localCreate.status, 201);
      FeedCreateResponseSchema.parse(proxyCreate.body);
      FeedCreateResponseSchema.parse(localCreate.body);
      assert.deepEqual(Object.keys(proxyCreate.body).sort(), Object.keys(localCreate.body).sort());

      const [proxyList, localList] = await Promise.all([
        getFeed(apiProxy.url, userToken, '?limit=10'),
        getFeed(apiLocal.url, userToken, '?limit=10'),
      ]);
      assert.equal(proxyList.status, 200);
      assert.equal(localList.status, 200);
      assert.deepEqual(proxyList.body, localList.body, 'el listado debe ser idéntico al revertir entre proxy y local');

      assertError(await createPost(apiLocal.url, userToken, { content: '' }), 400, 'ERR_VALIDATION_INVALID_FIELDS');
      assertError(await call(apiLocal.url, FEED_PATH), 401, 'ERR_AUTH_TOKEN_MISSING');
    });
  });

  describe('Fallos de comunicación, caída de proceso vs caída de base compartida', () => {
    test('timeout del proxy devuelve 504 ERR_FEED_UPSTREAM_TIMEOUT en tiempo finito', async () => {
      blackHole = await blackHoleServer(PORTS.blackHole);
      apiBlackHole = apiProcess({
        port: PORTS.apiBlackHole,
        databaseUrl: infra.databaseUrl,
        keys,
        feedMode: 'proxy',
        feedTarget: `http://127.0.0.1:${PORTS.blackHole}`,
        feedTimeoutMs: 1500,
      });
      await apiBlackHole.start({ readyPath: '/health/live' });
      const res = await getFeed(apiBlackHole.url, userToken);
      assertError(res, 504, 'ERR_FEED_UPSTREAM_TIMEOUT');
      assert.ok(res.ms >= 1400 && res.ms < 4500, `duración ${res.ms} ms`);
      const ready = await call(apiBlackHole.url, '/health/ready');
      assert.equal(ready.status, 200);
      assert.equal(ready.body.status, 'degraded');
      assert.equal(ready.body.checks.feed, 'down');
      await apiBlackHole.stop();
      await blackHole.close();
      apiBlackHole = blackHole = null;
    });

    test('caída del proceso apps/feed: 502 en Feed, API degradada, catálogos/perfil intactos y recuperación', async () => {
      await feedSvc.stop();
      const get = await getFeed(apiProxy.url, userToken);
      assertError(get, 502, 'ERR_FEED_UPSTREAM_UNAVAILABLE');
      const post = await createPost(apiProxy.url, userToken, { content: 'no debe llegar' });
      assertError(post, 502, 'ERR_FEED_UPSTREAM_UNAVAILABLE');

      const ready = await call(apiProxy.url, '/health/ready');
      assert.equal(ready.status, 200);
      assert.equal(ready.body.status, 'degraded');
      assert.equal(ready.body.checks.database, 'up');
      assert.equal(ready.body.checks.feed, 'down');

      // Flujos ajenos y modo local siguen operando
      assert.equal((await call(apiProxy.url, '/api/v1/catalogs')).status, 200);
      assert.equal((await call(apiProxy.url, '/api/v1/auth/profile-me', { headers: auth(userToken) })).status, 200);
      assert.equal((await getFeed(apiLocal.url, userToken)).status, 200);

      await feedSvc.start({ readyPath: '/health/ready' });
      assert.equal((await getFeed(apiProxy.url, userToken)).status, 200);
      assert.equal((await call(apiProxy.url, '/health/ready')).body.checks.feed, 'up');
    });

    test('caída de PostgreSQL compartido: API 503 unavailable, Feed 503, ambos fallan y se recuperan juntos', async () => {
      infra.stopPostgres();
      try {
        const apiReady = await call(apiProxy.url, '/health/ready');
        assert.equal(apiReady.status, 503);
        assert.equal(apiReady.body.status, 'unavailable');
        assert.equal(apiReady.body.checks.database, 'down');

        const feedReady = await call(feedSvc.url, '/health/ready');
        assert.equal(feedReady.status, 503);

        // Ni el modo proxy ni el modo local pueden servir Feed sin PostgreSQL compartido
        assertError(await getFeed(apiProxy.url, userToken), 500, 'ERR_SERVER_INTERNAL_ERROR');
        assertError(await getFeed(apiLocal.url, userToken), 500, 'ERR_SERVER_INTERNAL_ERROR');
      } finally {
        infra.startPostgres();
      }
      await infra.waitPostgresUp();
      await waitFor(async () => (await call(feedSvc.url, '/health/ready')).status === 200, { label: 'recuperación Feed PG', timeoutMs: 30000, intervalMs: 500 });
      await waitFor(async () => (await call(apiProxy.url, '/health/ready')).status === 200, { label: 'recuperación API PG', timeoutMs: 30000, intervalMs: 500 });
      assert.equal((await getFeed(apiProxy.url, userToken)).status, 200);
    });
  });

  describe('Permisos mínimos en PostgreSQL desechable', () => {
    test('apps/feed opera con rol restringido (SELECT/INSERT feed_posts + SELECT parcial users) y bloquea accesos ajenos', async () => {
      infra.psql(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'feed_min_priv') THEN
            CREATE ROLE feed_min_priv LOGIN PASSWORD 'feed_min_pass';
          END IF;
        END $$;
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM feed_min_priv;
        GRANT USAGE ON SCHEMA public TO feed_min_priv;
        GRANT SELECT, INSERT ON TABLE feed_posts TO feed_min_priv;
        GRANT SELECT (id, full_name, role) ON TABLE users TO feed_min_priv;
      `);

      const restrictedUrl = `postgres://feed_min_priv:feed_min_pass@127.0.0.1:${infra.o.pgPort}/social_unsch_e2e`;
      feedMinPriv = feedProcess({ port: PORTS.feedMinPriv, databaseUrl: restrictedUrl, keys });
      await feedMinPriv.start({ readyPath: '/health/ready' });

      const list = await getFeed(feedMinPriv.url, userToken);
      assert.equal(list.status, 200);
      FeedListResponseSchema.parse(list.body);

      const created = await createPost(feedMinPriv.url, userToken, { content: 'Post con rol de permisos mínimos' });
      assert.equal(created.status, 201);
      FeedCreateResponseSchema.parse(created.body);

      // Comprobar que PostgreSQL rechaza lecturas sensibles y escrituras fuera del dominio Feed
      assert.throws(() => infra.psqlAs('feed_min_priv', 'feed_min_pass', 'SELECT email FROM users LIMIT 1'), /permission denied/i);
      assert.throws(() => infra.psqlAs('feed_min_priv', 'feed_min_pass', "UPDATE users SET full_name = 'x'"), /permission denied/i);
      assert.throws(() => infra.psqlAs('feed_min_priv', 'feed_min_pass', 'SELECT count(*) FROM carpooling_routes'), /permission denied/i);

      await feedMinPriv.stop();
      feedMinPriv = null;
    });
  });

  describe('Matriz de modos RADAR_MODE × FEED_MODE (proxy/proxy y reversión independiente)', () => {
    test('proxy/proxy funciona con apps/radar y apps/feed separados, y la caída de uno no afecta al otro', async () => {
      await infra.startRedisContainer();
      radarSvc = radarProcess({ port: PORTS.radar, redisUrl: infra.redisUrl, keys });
      await radarSvc.start({ readyPath: '/health/ready' });

      apiBothProxy = apiProcess({
        port: PORTS.apiBothProxy,
        databaseUrl: infra.databaseUrl,
        redisUrl: infra.redisUrl,
        keys,
        radarMode: 'proxy',
        radarTarget: radarSvc.url,
        radarTimeoutMs: PROXY_TIMEOUT_MS,
        feedMode: 'proxy',
        feedTarget: feedSvc.url,
        feedTimeoutMs: PROXY_TIMEOUT_MS,
      });
      await apiBothProxy.start({ readyPath: '/health/ready' });

      const ready = await call(apiBothProxy.url, '/health/ready');
      assert.equal(ready.status, 200);
      assert.deepEqual(ready.body, { status: 'ready', checks: { database: 'up', radar: 'up', feed: 'up' } });

      const radarRes = await call(apiBothProxy.url, RADAR_PATH, { headers: auth(userToken) });
      assert.equal(radarRes.status, 200);
      RadarStatusResponseSchema.parse(radarRes.body);

      const feedRes = await getFeed(apiBothProxy.url, userToken);
      assert.equal(feedRes.status, 200);
      FeedListResponseSchema.parse(feedRes.body);

      // Caída de apps/feed: Radar sigue 200 en proxy/proxy
      await feedSvc.stop();
      assertError(await getFeed(apiBothProxy.url, userToken), 502, 'ERR_FEED_UPSTREAM_UNAVAILABLE');
      assert.equal((await call(apiBothProxy.url, RADAR_PATH, { headers: auth(userToken) })).status, 200);
      await feedSvc.start({ readyPath: '/health/ready' });

      // Caída de apps/radar: Feed sigue 200 en proxy/proxy
      await radarSvc.stop();
      assertError(await call(apiBothProxy.url, RADAR_PATH, { headers: auth(userToken) }), 502, 'ERR_RADAR_UPSTREAM_UNAVAILABLE');
      assert.equal((await getFeed(apiBothProxy.url, userToken)).status, 200);

      await apiBothProxy.stop();
      apiBothProxy = null;
      radarSvc = null;
    });
  });

  describe('Cierre ordenado (SIGTERM)', () => {
    test('apiLocal, apiProxy y feedSvc terminan al recibir SIGTERM sin forzarse', async () => {
      for (const p of [apiLocal, apiProxy, feedSvc]) {
        const result = await p.stop();
        assert.ok(result && !result.forced, `${p.name} no terminó a tiempo`);
      }
      apiLocal = apiProxy = feedSvc = null;
    });
  });
});
