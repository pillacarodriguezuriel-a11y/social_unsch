/**
 * Integration Test Suite: modo proxy del Radar (RADAR_MODE=proxy, desactivado por defecto)
 *
 * El destino es un servidor HTTP local y desechable creado en cada prueba. Nunca se contacta
 * un servicio externo.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import http, { IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { ErrorResponseSchema } from '@social-unsch/contracts';
import { buildUpstreamUrl, createRadarProxyModule } from '../../src/modules/radar/radar.proxy';
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
    res.end(JSON.stringify({ ok: true }));
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
  createTestApp({ radar: createRadarProxyModule({ target: upstreamUrl, timeoutMs }) });

describe('reenvío', () => {
  it('conserva método, ruta, query, cuerpo JSON y Authorization, y devuelve estado y cuerpo del destino', async () => {
    handler = (_req, res) => {
      res.writeHead(201, { 'content-type': 'application/json', 'x-internal-secret': 'no-debe-salir' });
      res.end(JSON.stringify({ message: 'desde el destino', updated: false, votes_current: 1, votes_required: 3 }));
    };

    const res = await request(appWithProxy())
      .post('/api/v1/radar/report?origen=prueba&x=1')
      .set('Authorization', 'Bearer abc.def.ghi')
      .set('Cookie', 'sesion=secreta')
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'desde el destino', updated: false, votes_current: 1, votes_required: 3 });
    expect(res.headers['x-internal-secret']).toBeUndefined();

    expect(captured).toHaveLength(1);
    const [req] = captured;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/api/v1/radar/report?origen=prueba&x=1');
    expect(req.headers.authorization).toBe('Bearer abc.def.ghi');
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.headers.cookie).toBeUndefined();
    expect(JSON.parse(req.body)).toEqual({ node: 'comedor', status: 'fluid' });
  });

  it('reenvía GET sin cuerpo', async () => {
    const res = await request(appWithProxy()).get('/api/v1/radar/status').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toBe('/api/v1/radar/status');
    expect(captured[0].body).toBe('');
  });

  it('pasa sin alterar los errores del destino (por ejemplo 401)', async () => {
    handler = (_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: 'Acceso denegado.', code: 'ERR_AUTH_TOKEN_MISSING' }));
    };
    const res = await request(appWithProxy()).get('/api/v1/radar/status');
    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.parse(res.body).code).toBe('ERR_AUTH_TOKEN_MISSING');
  });

  it('no envía al destino rutas ajenas al radar', async () => {
    const res = await request(appWithProxy()).get('/api/v1/catalogs/no-existe');
    expect(res.status).toBe(404);
    expect(captured).toHaveLength(0);
  });
});

describe('fallos', () => {
  it('ante tiempo agotado responde 504 ERR_RADAR_UPSTREAM_TIMEOUT y hace un solo intento', async () => {
    handler = () => {
      /* no responde nunca */
    };
    const res = await request(appWithProxy(150))
      .post('/api/v1/radar/report')
      .set('Authorization', 'Bearer t')
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(504);
    expect(ErrorResponseSchema.parse(res.body).code).toBe('ERR_RADAR_UPSTREAM_TIMEOUT');
    expect(captured.length).toBeLessThanOrEqual(1);
  });

  it('si el destino no acepta conexiones responde 502 ERR_RADAR_UPSTREAM_UNAVAILABLE sin reintentar', async () => {
    const calls: string[] = [];
    const failingFetch = jest.fn(async (url: string) => {
      calls.push(url);
      throw new TypeError('fetch failed');
    });
    const app = createTestApp({
      radar: createRadarProxyModule({ target: upstreamUrl, timeoutMs: 500, fetchImpl: failingFetch }),
    });

    const res = await request(app).post('/api/v1/radar/report').send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(502);
    expect(ErrorResponseSchema.parse(res.body).code).toBe('ERR_RADAR_UPSTREAM_UNAVAILABLE');
    expect(calls).toHaveLength(1);
  });

  it('un 5xx del destino se devuelve tal cual, sin repetir la escritura', async () => {
    handler = (_req, res) => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: 'no disponible', code: 'ERR_SERVER_INTERNAL_ERROR' }));
    };
    const res = await request(appWithProxy()).post('/api/v1/radar/report').send({ node: 'comedor', status: 'fluid' });
    expect(res.status).toBe(503);
    expect(captured).toHaveLength(1);
  });
});

describe('destino fijado por la configuración del servidor', () => {
  it('la solicitud no puede cambiar el host de destino', () => {
    const target = new URL('http://radar.interno:4000');
    const url = buildUpstreamUrl(target, {
      baseUrl: '/api/v1/radar',
      path: '//evil.example.com/x',
      originalUrl: '/api/v1/radar//evil.example.com/x?a=1',
    });
    expect(new URL(url).host).toBe('radar.interno:4000');
    expect(url).toBe('http://radar.interno:4000/api/v1/radar//evil.example.com/x?a=1');
  });

  it('conserva un prefijo de ruta del destino', () => {
    const url = buildUpstreamUrl(new URL('https://radar.interno/servicio/'), {
      baseUrl: '/api/v1/radar',
      path: '/status',
      originalUrl: '/api/v1/radar/status',
    });
    expect(url).toBe('https://radar.interno/servicio/api/v1/radar/status');
  });

  it('las cabeceras Host o X-Forwarded-Host no redirigen la solicitud', async () => {
    const res = await request(appWithProxy())
      .get('/api/v1/radar/status')
      .set('X-Forwarded-Host', 'evil.example.com');
    expect(res.status).toBe(200);
    expect(captured).toHaveLength(1);
  });
});

describe('readiness del modo proxy', () => {
  it('consulta /health/live del destino', async () => {
    const mod = createRadarProxyModule({ target: upstreamUrl, timeoutMs: 500 });
    await expect(mod.checkReady()).resolves.toBe(true);
    expect(captured[0].url).toBe('/health/live');
  });

  it('devuelve false si el destino no responde a tiempo', async () => {
    handler = () => {
      /* sin respuesta */
    };
    const mod = createRadarProxyModule({ target: upstreamUrl, timeoutMs: 100 });
    await expect(mod.checkReady()).resolves.toBe(false);
  });
});
