/**
 * Integration Test Suite: aplicación Express del servicio Feed (createFeedApp)
 *
 * Monta la aplicación completa con dependencias simuladas (pool, authGuard) y
 * verifica las rutas de salud, el controlador Feed y el middleware de error.
 * No abre conexiones externas.
 */
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createFeedApp } from '../../src/app';
import { FeedError } from '@social-unsch/feed-domain';
import type { IFeedPost } from '@social-unsch/feed-domain';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makePool(queryResult: { rows: unknown[] } = { rows: [] }) {
  return {
    query: jest.fn().mockResolvedValue(queryResult),
    end: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeAuthGuard(userId = 'user-int-001', role = 'student') {
  return jest.fn((req: any, _res: any, next: any) => {
    req.user = { userId, role };
    next();
  });
}

function makeDenyGuard() {
  return jest.fn((_req: any, res: any) => {
    res.status(401).json({ error: true, message: 'No autorizado.', code: 'ERR_AUTH_TOKEN_MISSING' });
  });
}

const makePost = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
  id: 'post-int-001',
  user_id: 'user-int-001',
  faculty_id: 1,
  professional_school_id: 3,
  content: 'Publicación de integración',
  is_visible: true,
  created_at: new Date('2026-11-01T00:00:00Z'),
  author_name: 'Autor Int',
  author_role: 'student',
  ...overrides,
});

// ─── Health Routes ─────────────────────────────────────────────────────────────

describe('Health Routes', () => {
  it('GET /health/live → 200 siempre', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready → 200 cuando PostgreSQL responde', async () => {
    const pool = makePool({ rows: [{ '?column?': 1 }] });
    const app = createFeedApp({ pool, authGuard: makeAuthGuard() });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks?.database).toBe('up');
  });

  it('GET /health/ready → 503 cuando PostgreSQL falla', async () => {
    const pool = { query: jest.fn().mockRejectedValue(new Error('DB offline')), end: jest.fn() } as any;
    const app = createFeedApp({ pool, authGuard: makeAuthGuard() });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.checks?.database).toBe('down');
  });
});

// ─── GET /api/v1/feed ─────────────────────────────────────────────────────────

describe('GET /api/v1/feed', () => {
  it('devuelve 200 con un array de posts cuando el authGuard pasa', async () => {
    const post = makePost();
    const pool = makePool({ rows: [post] });
    const app = createFeedApp({ pool, authGuard: makeAuthGuard() });

    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('post-int-001');
  });

  it('devuelve 401 cuando el authGuard rechaza', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeDenyGuard() });
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(401);
  });

  it('devuelve 400 cuando un query param no es numérico', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app).get('/api/v1/feed?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('devuelve 200 con array vacío cuando no hay posts', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [] }), authGuard: makeAuthGuard() });
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('pasa facultyId y schoolId como filtros al repositorio', async () => {
    const pool = makePool({ rows: [] });
    const app = createFeedApp({ pool, authGuard: makeAuthGuard() });
    await request(app).get('/api/v1/feed?faculty_id=2&school_id=5');
    expect(pool.query).toHaveBeenCalled();
    const queryArg = pool.query.mock.calls[0][0];
    expect(queryArg.values).toContain(2);
    expect(queryArg.values).toContain(5);
  });
});

// ─── POST /api/v1/feed ────────────────────────────────────────────────────────

describe('POST /api/v1/feed', () => {
  it('devuelve 201 con post_id cuando el contenido es válido', async () => {
    const postRow = {
      id: 'new-post-001',
      user_id: 'user-int-001',
      content: 'Nuevo post',
      is_visible: true,
      created_at: new Date(),
    };
    const pool = makePool({ rows: [postRow] });
    const app = createFeedApp({ pool, authGuard: makeAuthGuard() });

    const res = await request(app)
      .post('/api/v1/feed')
      .send({ content: 'Nuevo post' });
    expect(res.status).toBe(201);
    expect(res.body.post_id).toBe('new-post-001');
  });

  it('devuelve 400 ERR_VALIDATION_INVALID_FIELDS cuando el contenido está vacío', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app).post('/api/v1/feed').send({ content: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('devuelve 400 ERR_VALIDATION_INVALID_FIELDS cuando el contenido supera 2000 chars', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app).post('/api/v1/feed').send({ content: 'A'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('devuelve 401 cuando el usuario no está en el contexto (authGuard no establece req.user)', async () => {
    const noUserGuard = jest.fn((req: any, _res: any, next: any) => {
      req.user = undefined;
      next();
    });
    const app = createFeedApp({ pool: makePool(), authGuard: noUserGuard });
    const res = await request(app).post('/api/v1/feed').send({ content: 'Test' });
    expect(res.status).toBe(401);
  });

  it('devuelve 401 cuando el authGuard rechaza', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeDenyGuard() });
    const res = await request(app).post('/api/v1/feed').send({ content: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ─── Error Middleware ─────────────────────────────────────────────────────────

describe('Error Middleware', () => {
  it('convierte FeedError en la respuesta con statusCode y errorCode correctos', async () => {
    const errorGuard = jest.fn((_req: any, _res: any, next: any) => {
      next(new FeedError('Error de prueba', 422, 'ERR_FEED_TEST'));
    });
    const app = createFeedApp({ pool: makePool(), authGuard: errorGuard });
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ERR_FEED_TEST');
    expect(res.body.error).toBe(true);
  });

  it('devuelve 500 ante error no controlado', async () => {
    const crashGuard = jest.fn((_req: any, _res: any, next: any) => {
      next(new Error('falla inesperada'));
    });
    const app = createFeedApp({ pool: makePool(), authGuard: crashGuard });
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(500);
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

describe('Ruta no encontrada', () => {
  it('devuelve 404 con code ERR_NOT_FOUND para rutas desconocidas', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app).get('/ruta/desconocida');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ERR_NOT_FOUND');
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('permite un origen configurado en allowedOrigins', async () => {
    const app = createFeedApp({
      pool: makePool({ rows: [] }),
      authGuard: makeAuthGuard(),
      allowedOrigins: ['https://app.ejemplo'],
    });
    const res = await request(app)
      .get('/health/live')
      .set('Origin', 'https://app.ejemplo');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.ejemplo');
  });

  it('usa cors() sin restricciones cuando allowedOrigins no está definido', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [] }), authGuard: makeAuthGuard() });
    const res = await request(app)
      .get('/health/live')
      .set('Origin', 'https://cualquier.origen');
    expect(res.status).toBe(200);
  });
});

// ─── Logging Middleware ───────────────────────────────────────────────────────

describe('Logging Middleware', () => {
  it('no incluye el header Authorization en los logs (sin registro de tokens)', async () => {
    const logLines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => logLines.push(args.join('')));
    const app = createFeedApp({
      pool: makePool({ rows: [] }),
      authGuard: makeAuthGuard(),
      serviceName: 'test-feed-logger',
    });
    await request(app).get('/api/v1/feed').set('Authorization', 'Bearer secret-token');
    expect(logLines.join('')).not.toContain('secret-token');
    jest.restoreAllMocks();
  });

  it('usa el x-request-id del header cuando es alfanumérico válido', async () => {
    const logLines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => logLines.push(args.join('')));
    const app = createFeedApp({ pool: makePool({ rows: [] }), authGuard: makeAuthGuard() });
    await request(app).get('/api/v1/feed').set('x-request-id', 'req-abc-123');
    const logged = JSON.parse(logLines[0]);
    expect(logged.requestId).toBe('req-abc-123');
    jest.restoreAllMocks();
  });

  it('genera UUID cuando x-request-id falta o tiene formato inválido', async () => {
    const logLines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => logLines.push(args.join('')));
    const app = createFeedApp({ pool: makePool({ rows: [] }), authGuard: makeAuthGuard() });
    await request(app).get('/api/v1/feed');
    const logged = JSON.parse(logLines[0]);
    expect(logged.requestId).toMatch(/^[0-9a-f-]{36}$/);
    jest.restoreAllMocks();
  });
});

// ─── Ramas de error específicas ───────────────────────────────────────────────

describe('Ramas específicas de cobertura', () => {
  it('feed.controller getFeed propaga error de repositorio a next()', async () => {
    const crashPool = {
      query: jest.fn().mockRejectedValue(new Error('DB crash')),
      end: jest.fn(),
    } as any;
    const app = createFeedApp({ pool: crashPool, authGuard: makeAuthGuard() });
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(500);
  });

  it('feed.controller POST rechaza faculty_id no numérico', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app)
      .post('/api/v1/feed')
      .send({ content: 'Test', faculty_id: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('feed.controller POST rechaza school_id no numérico', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: makeAuthGuard() });
    const res = await request(app)
      .post('/api/v1/feed')
      .send({ content: 'Test', school_id: 'xyz' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('error.middleware pasa el error a next() cuando los headers ya están enviados', () => {
    const { errorMiddleware } = require('../../src/middlewares/error.middleware');
    const mockNext = jest.fn();
    const fakeRes = { headersSent: true, locals: {}, status: jest.fn(), json: jest.fn() };
    const testErr = new Error('error cuando headers ya enviados');
    errorMiddleware(testErr, {} as any, fakeRes as any, mockNext);
    expect(mockNext).toHaveBeenCalledWith(testErr);
    expect(fakeRes.status).not.toHaveBeenCalled();
  });
});
