/**
 * Integration Test Suite: modo proxy del Feed (FEED_MODE=proxy, desactivado por defecto)
 *
 * El destino es un servidor HTTP local y desechable creado en cada prueba. Nunca se
 * contacta un servicio externo.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import http, { IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { buildUpstreamPath, createFeedProxyModule } from '../../src/modules/feed/feed.proxy';
import { createTestApp } from '../helpers/test-app';

interface Captured {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

let upstream: Server;
let upstreamUrl: URL;
let captured: Captured[];
let handler: (req: IncomingMessage, res: ServerResponse, body: string) => void;

beforeEach(async () => {
  captured = [];
  handler = (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [] }));
  };
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, res, body);
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  upstreamUrl = new URL(`http://127.0.0.1:${(upstream.address() as AddressInfo).port}`);
});

afterEach(async () => {
  upstream.closeAllConnections?.();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

const appWithProxy = (timeoutMs = 1000) =>
  createTestApp({ feedRouter: createFeedProxyModule({ target: upstreamUrl, timeoutMs }).router });

describe('reenvío', () => {
  it('conserva método, ruta, query, cuerpo JSON y Authorization, y devuelve estado y cuerpo del destino', async () => {
    handler = (_req, res) => {
      res.writeHead(201, { 'content-type': 'application/json', 'x-internal-secret': 'no-debe-salir' });
      res.end(JSON.stringify([{ id: 'post-001', content: 'Hola' }]));
    };

    const res = await request(appWithProxy())
      .post('/api/v1/feed?origen=prueba')
      .set('Authorization', 'Bearer tok.en.jwt')
      .set('Cookie', 'sesion=secreta')
      .send({ content: 'Contenido de prueba' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual([{ id: 'post-001', content: 'Hola' }]);
    expect(res.headers['x-internal-secret']).toBeUndefined();

    expect(captured).toHaveLength(1);
    const [req] = captured;
    expect(req.method).toBe('POST');
    // Express normalizes the path; root path becomes '/api/v1/feed/' (trailing slash)
    expect(req.url).toMatch(/^\/api\/v1\/feed[/]?\?origen=prueba$/);
    expect(req.headers.authorization).toBe('Bearer tok.en.jwt');
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.headers.cookie).toBeUndefined();
    expect(JSON.parse(req.body)).toEqual({ content: 'Contenido de prueba' });
  });

  it('reenvía GET sin cuerpo', async () => {
    const res = await request(appWithProxy()).get('/api/v1/feed').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toMatch(/^\/api\/v1\/feed[/]?$/);
    expect(captured[0].body).toBe('');
  });

  it('pasa sin alterar los errores del destino (por ejemplo 401)', async () => {
    handler = (_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: 'Token requerido.', code: 'ERR_AUTH_TOKEN_MISSING' }));
    };
    const res = await request(appWithProxy()).get('/api/v1/feed');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
  });

  it('no envía al destino rutas ajenas al feed', async () => {
    const res = await request(appWithProxy()).get('/api/v1/catalogs/no-existe');
    expect(res.status).toBe(404);
    expect(captured).toHaveLength(0);
  });
});

describe('fallos', () => {
  it('ante tiempo agotado responde 504 ERR_FEED_UPSTREAM_TIMEOUT y hace un solo intento', async () => {
    handler = () => {
      /* no responde nunca */
    };
    const res = await request(appWithProxy(150))
      .post('/api/v1/feed')
      .set('Authorization', 'Bearer t')
      .send({ content: 'test' });

    expect(res.status).toBe(504);
    expect(res.body.code).toBe('ERR_FEED_UPSTREAM_TIMEOUT');
    expect(captured.length).toBeLessThanOrEqual(1);
  });

  it('si el destino no acepta conexiones responde 502 ERR_FEED_UPSTREAM_UNAVAILABLE sin reintentar', async () => {
    upstream.closeAllConnections?.();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    const mod = createFeedProxyModule({ target: upstreamUrl, timeoutMs: 500 });
    const app = createTestApp({ feedRouter: mod.router });

    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ERR_FEED_UPSTREAM_UNAVAILABLE');
    await expect(mod.checkReady()).resolves.toBe(false);
    mod.close?.();
  });

  it('un 5xx del destino se devuelve tal cual', async () => {
    handler = (_req, res) => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: 'no disponible', code: 'ERR_SERVER_INTERNAL_ERROR' }));
    };
    const res = await request(appWithProxy()).get('/api/v1/feed');
    expect(res.status).toBe(503);
    expect(captured).toHaveLength(1);
  });

  it('checkReady devuelve true cuando el destino responde 200', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      res.end('{}');
    };
    const mod = createFeedProxyModule({ target: upstreamUrl, timeoutMs: 1000, healthPath: '/health/ready' });
    await expect(mod.checkReady()).resolves.toBe(true);
    mod.close?.();
  });
});

describe('buildUpstreamPath', () => {
  it('combina target pathname y baseUrl+path de la solicitud', () => {
    const result = buildUpstreamPath('/', {
      baseUrl: '/api/v1/feed',
      path: '/',
      originalUrl: '/api/v1/feed/',
    });
    expect(result).toBe('/api/v1/feed/');
  });

  it('preserva la query string de la solicitud original', () => {
    const result = buildUpstreamPath('/', {
      baseUrl: '/api/v1/feed',
      path: '/',
      originalUrl: '/api/v1/feed/?page=2&limit=10',
    });
    expect(result).toBe('/api/v1/feed/?page=2&limit=10');
  });

  it('devuelve solo una ruta relativa: no incluye scheme ni autoridad', () => {
    // Aunque la ruta contenga un segmento que parece un host (doble barra), la función
    // devuelve una cadena de ruta. Node.js http.request usa 'hostname' del destino fijo
    // para conectarse; el campo 'path' nunca puede cambiar el host.
    const result = buildUpstreamPath('/', {
      baseUrl: '/api/v1/feed',
      path: '//evil.example.com/x',
      originalUrl: '/api/v1/feed//evil.example.com/x?a=1',
    });
    // El resultado es una cadena de ruta (sin scheme ni host como prefijo)
    expect(result).not.toMatch(/^https?:\/\//);
    // Comienza con la ruta base del feed
    expect(result).toMatch(/^\/api\/v1\/feed\//);
  });
});
