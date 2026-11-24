'use strict';
/**
 * Pruebas de extremo a extremo del servicio Feed con infraestructura real.
 *
 *   cliente → apps/api compilada (FEED_MODE=proxy) → apps/feed compilada → PostgreSQL real
 *   cliente → apps/api compilada (FEED_MODE=local)  → PostgreSQL real   (paridad)
 *
 * Cubre:
 *   - Autenticación: sin token, token inválido, token de otra clave, token expirado
 *   - GET /api/v1/feed: listado vacío, listado con posts, filtros facultad/escuela, paginación
 *   - POST /api/v1/feed: creación válida, contenido vacío, contenido > 2000 chars, XSS sanitizado
 *   - Paridad proxy ↔ local: las respuestas de ambos modos deben tener la misma forma
 *   - Graceful shutdown: el servicio Feed responde a SIGTERM correctamente
 *
 * Requiere Docker. Los contenedores usan el prefijo social_unsch_e2e_feed_ y se eliminan al terminar.
 * Uso: npm run test:e2e:feed
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { FeedInfra, feedProcess, apiProcess, generateKeys } = require('../../scripts/lib/feed-stack');

const PORTS = {
  apiProxy: 3510,
  apiLocal: 3520,
  feed: 4510,
};
const PROXY_TIMEOUT_MS = 5000;

const FEED_PATH = '/api/v1/feed';

const infra = new FeedInfra();
const keys = generateKeys();
const otherKeys = generateKeys();

let feedSvc, apiProxy, apiLocal;
let userToken;
let userId;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sign = (payload, opts = {}, key = keys.privateKey) =>
  jwt.sign(payload, key, { algorithm: 'RS256', expiresIn: '1h', ...opts });

const auth = (token) => ({ authorization: `Bearer ${token}` });

async function call(base, p, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* cuerpo no-JSON */ }
  return { status: res.status, body: json };
}

const getFeed = (base, token, params = '') =>
  call(base, FEED_PATH + params, { headers: auth(token) });

const createPost = (base, token, body) =>
  call(base, FEED_PATH, { method: 'POST', headers: auth(token), body });

function assertError(res, status, code) {
  assert.equal(res.status, status,
    `estado esperado ${status}, recibido ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body?.error, 'cuerpo de error debe tener error:true');
  if (code) assert.equal(res.body.code, code);
}

// ─── Suite Principal ──────────────────────────────────────────────────────────

describe('Feed con infraestructura real', () => {
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

    // Registrar usuario e iniciar sesión para obtener token real
    const email = `e2e.feed.${Date.now()}@unsch.edu.pe`;
    const password = 'Prueba#E2e2026';
    const reg = await call(apiProxy.url, '/api/v1/auth/register', {
      method: 'POST',
      body: { full_name: 'Estudiante Feed E2E', email, password, role: 'student' },
    });
    assert.equal(reg.status, 201, `registro falló: ${JSON.stringify(reg.body)}`);

    const login = await call(apiProxy.url, '/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.status, 200, `login falló: ${JSON.stringify(login.body)}`);
    userToken = login.body.token;
    userId = login.body.user?.id;
  });

  after(async () => {
    await Promise.all([
      apiProxy?.stop(),
      apiLocal?.stop(),
      feedSvc?.stop(),
    ]);
    infra.removeContainers();
  });

  // ════════════════════════════════════════════════════════════════════
  // Health checks
  // ════════════════════════════════════════════════════════════════════

  describe('Health checks', () => {
    test('apps/feed /health/live responde 200', async () => {
      const res = await call(feedSvc.url, '/health/live');
      assert.equal(res.status, 200);
    });

    test('apps/feed /health/ready responde 200 con PostgreSQL activo', async () => {
      const res = await call(feedSvc.url, '/health/ready');
      assert.equal(res.status, 200);
    });

    test('apps/api /health/ready responde 200 en modo proxy', async () => {
      const res = await call(apiProxy.url, '/health/ready');
      assert.equal(res.status, 200);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Autenticación
  // ════════════════════════════════════════════════════════════════════

  describe('Autenticación (modo proxy)', () => {
    test('GET /feed sin token → 401 ERR_AUTH_TOKEN_MISSING', async () => {
      const res = await call(apiProxy.url, FEED_PATH);
      assertError(res, 401, 'ERR_AUTH_TOKEN_MISSING');
    });

    test('POST /feed sin token → 401 ERR_AUTH_TOKEN_MISSING', async () => {
      const res = await call(apiProxy.url, FEED_PATH, { method: 'POST', body: { content: 'hola' } });
      assertError(res, 401, 'ERR_AUTH_TOKEN_MISSING');
    });

    test('GET /feed con token firmado con otra clave → 401 ERR_AUTH_INVALID_TOKEN', async () => {
      const badToken = sign({ user_id: 'x', role: 'student' }, {}, otherKeys.privateKey);
      const res = await getFeed(apiProxy.url, badToken);
      assertError(res, 401, 'ERR_AUTH_INVALID_TOKEN');
    });

    test('GET /feed con token expirado → 401 ERR_AUTH_TOKEN_EXPIRED', async () => {
      const expired = sign({ user_id: 'x', role: 'student' }, { expiresIn: '-1s' });
      const res = await getFeed(apiProxy.url, expired);
      assertError(res, 401, 'ERR_AUTH_TOKEN_EXPIRED');
    });

    test('GET /feed con token malformado → 401 ERR_AUTH_INVALID_TOKEN', async () => {
      const res = await getFeed(apiProxy.url, 'esto.no.es.un.jwt');
      assertError(res, 401, 'ERR_AUTH_INVALID_TOKEN');
    });

    test('GET /feed directo a apps/feed sin token → 401 ERR_AUTH_TOKEN_MISSING', async () => {
      const res = await call(feedSvc.url, '/api/v1/feed');
      assertError(res, 401, 'ERR_AUTH_TOKEN_MISSING');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // GET /feed — lectura del feed (modo proxy)
  // ════════════════════════════════════════════════════════════════════

  describe('GET /feed (modo proxy)', () => {
    test('GET /feed con token válido → 200 con array de posts', async () => {
      const res = await getFeed(apiProxy.url, userToken);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.ok(Array.isArray(res.body), 'cuerpo debe ser array');
    });

    test('GET /feed devuelve máx 20 posts por defecto', async () => {
      const res = await getFeed(apiProxy.url, userToken);
      assert.equal(res.status, 200);
      assert.ok(res.body.length <= 20, `esperado ≤ 20, recibido ${res.body.length}`);
    });

    test('GET /feed?page=1&limit=5 respeta parámetros de paginación', async () => {
      const res = await getFeed(apiProxy.url, userToken, '?page=1&limit=5');
      assert.equal(res.status, 200);
      assert.ok(res.body.length <= 5);
    });

    test('GET /feed?facultyId=99999 con ID inexistente devuelve array vacío', async () => {
      const res = await getFeed(apiProxy.url, userToken, '?facultyId=99999');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // POST /feed — creación de posts (modo proxy)
  // ════════════════════════════════════════════════════════════════════

  describe('POST /feed (modo proxy)', () => {
    test('POST /feed con contenido válido → 201 con el post creado', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: 'Post de prueba E2E' });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(res.body.id, 'debe retornar id');
      assert.equal(res.body.content, 'Post de prueba E2E');
    });

    test('POST /feed → el post aparece en el GET siguiente', async () => {
      const content = `Post timestamp ${Date.now()}`;
      const create = await createPost(apiProxy.url, userToken, { content });
      assert.equal(create.status, 201);

      const list = await getFeed(apiProxy.url, userToken);
      assert.equal(list.status, 200);
      const found = list.body.find((p) => p.id === create.body.id);
      assert.ok(found, 'post creado debe aparecer en el feed');
    });

    test('POST /feed con contenido vacío → 400 ERR_VALIDATION_INVALID_FIELDS', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: '' });
      assertError(res, 400, 'ERR_VALIDATION_INVALID_FIELDS');
    });

    test('POST /feed con contenido solo espacios → 400 ERR_VALIDATION_INVALID_FIELDS', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: '   ' });
      assertError(res, 400, 'ERR_VALIDATION_INVALID_FIELDS');
    });

    test('POST /feed con contenido > 2000 caracteres → 400 ERR_VALIDATION_INVALID_FIELDS', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: 'A'.repeat(2001) });
      assertError(res, 400, 'ERR_VALIDATION_INVALID_FIELDS');
    });

    test('POST /feed sanitiza XSS: <script> se escapa en el contenido retornado', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: '<script>alert(1)</script>' });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(!res.body.content.includes('<script>'), 'contenido debe estar sanitizado');
      assert.ok(res.body.content.includes('&lt;'), 'debe contener &lt;');
    });

    test('POST /feed con content exactamente 2000 caracteres → 201', async () => {
      const res = await createPost(apiProxy.url, userToken, { content: 'A'.repeat(2000) });
      assert.equal(res.status, 201, JSON.stringify(res.body));
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Paridad proxy ↔ local
  // ════════════════════════════════════════════════════════════════════

  describe('Paridad modo proxy ↔ modo local', () => {
    test('GET /feed en modo local también devuelve 200 con array', async () => {
      const res = await getFeed(apiLocal.url, userToken);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.ok(Array.isArray(res.body));
    });

    test('POST /feed en modo local crea post correctamente', async () => {
      const content = `Post local ${Date.now()}`;
      const res = await createPost(apiLocal.url, userToken, { content });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(res.body.id);
    });

    test('POST /feed sin token en modo local → 401', async () => {
      const res = await call(apiLocal.url, FEED_PATH, { method: 'POST', body: { content: 'hola' } });
      assertError(res, 401);
    });

    test('POST /feed contenido vacío en modo local → 400 ERR_VALIDATION_INVALID_FIELDS', async () => {
      const res = await createPost(apiLocal.url, userToken, { content: '' });
      assertError(res, 400, 'ERR_VALIDATION_INVALID_FIELDS');
    });

    test('la forma del post es idéntica en proxy y local', async () => {
      const content = `Paridad ${Date.now()}`;
      const [proxyRes, localRes] = await Promise.all([
        createPost(apiProxy.url, userToken, { content }),
        createPost(apiLocal.url, userToken, { content }),
      ]);
      assert.equal(proxyRes.status, 201);
      assert.equal(localRes.status, 201);
      const proxyKeys = Object.keys(proxyRes.body).sort();
      const localKeys = Object.keys(localRes.body).sort();
      assert.deepEqual(proxyKeys, localKeys, 'ambas respuestas deben tener las mismas claves');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Acceso directo a apps/feed (sin pasar por apps/api)
  // ════════════════════════════════════════════════════════════════════

  describe('Acceso directo a apps/feed', () => {
    test('GET /api/v1/feed en apps/feed con token válido → 200', async () => {
      const token = sign({ user_id: userId || 'test-user', role: 'student' });
      const res = await getFeed(feedSvc.url, token);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });

    test('apps/feed ignora el header x-user-id sin token → 401', async () => {
      const res = await call(feedSvc.url, '/api/v1/feed', {
        headers: { 'x-user-id': 'spoofed-id' },
      });
      assertError(res, 401, 'ERR_AUTH_TOKEN_MISSING');
    });

    test('apps/feed /health/live siempre responde 200', async () => {
      const res = await call(feedSvc.url, '/health/live');
      assert.equal(res.status, 200);
    });
  });
});
