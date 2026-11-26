/**
 * Contract Test Suite: Feed HTTP (/api/v1/feed) en el servicio independiente
 *
 * Par de apps/api/tests/contract/feed.contract.test.ts: valida las respuestas
 * de `apps/feed` contra los mismos esquemas de @social-unsch/contracts. Si los
 * dos archivos pasan, activar FEED_MODE=proxy no cambia lo que ve el cliente.
 *
 * PostgreSQL y el guardia de autenticación se inyectan como dobles.
 */

import request from 'supertest';
import {
  ErrorResponseSchema,
  FEED_CONTENT_MAX_LENGTH,
  FEED_ERROR_CODES,
  FEED_ROUTES,
  FeedCreateResponseSchema,
  FeedListResponseSchema,
} from '@social-unsch/contracts';
import { createFeedApp } from '../../src/app';

const dbRow = {
  id: 'post-contract-0001',
  user_id: 'user-feed-contract-0001',
  faculty_id: 1,
  professional_school_id: 3,
  content: 'Publicación de contrato',
  is_visible: true,
  created_at: new Date('2026-11-25T10:00:00Z'),
  author_name: 'Autor Contrato',
  author_role: 'student',
};

function makePool(...results: Array<{ rows: unknown[] }>) {
  const query = jest.fn();
  for (const result of results) query.mockResolvedValueOnce(result);
  query.mockResolvedValue({ rows: [] });
  return { query, end: jest.fn() } as any;
}

const authGuard = jest.fn((req: any, _res: any, next: any) => {
  req.user = { userId: 'user-feed-contract-0001', role: 'student' };
  next();
});

const denyGuard = jest.fn((_req: any, res: any) =>
  res.status(401).json({ error: true, message: 'Token requerido.', code: 'ERR_AUTH_TOKEN_MISSING' })
);

describe(`${FEED_ROUTES.list.method} ${FEED_ROUTES.list.path}`, () => {
  it('cumple FeedListResponseSchema con publicaciones', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [dbRow] }), authGuard });

    const res = await request(app).get(FEED_ROUTES.list.path);

    expect(res.status).toBe(200);
    expect(FeedListResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('cumple FeedListResponseSchema con lista vacía', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [] }), authGuard });

    const res = await request(app).get(FEED_ROUTES.list.path);

    expect(res.status).toBe(200);
    expect(FeedListResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('created_at viaja como texto ISO 8601, no como objeto', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [dbRow] }), authGuard });

    const res = await request(app).get(FEED_ROUTES.list.path);

    expect(typeof res.body.data[0].created_at).toBe('string');
    expect(new Date(res.body.data[0].created_at).toISOString()).toBe('2026-11-25T10:00:00.000Z');
  });

  it('un parámetro no numérico da 400 con el formato de error del contrato', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard });

    const res = await request(app).get(`${FEED_ROUTES.list.path}?page=abc`);

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('sin token válido da 401 con el formato de error del contrato', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard: denyGuard });

    const res = await request(app).get(FEED_ROUTES.list.path);

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.code in FEED_ERROR_CODES).toBe(true);
  });
});

describe(`${FEED_ROUTES.create.method} ${FEED_ROUTES.create.path}`, () => {
  const authorRow = { rows: [{ full_name: 'Autor Contrato', role: 'student' }] };

  it('cumple FeedCreateResponseSchema con 201', async () => {
    const app = createFeedApp({ pool: makePool({ rows: [dbRow] }, authorRow), authGuard });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .send({ content: 'Publicación de contrato' });

    expect(res.status).toBe(201);
    expect(FeedCreateResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('contenido vacío da 400 con el formato de error del contrato', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard });

    const res = await request(app).post(FEED_ROUTES.create.path).send({ content: '   ' });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it(`contenido por encima de ${FEED_CONTENT_MAX_LENGTH} caracteres da 400`, async () => {
    const app = createFeedApp({ pool: makePool(), authGuard });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .send({ content: 'A'.repeat(FEED_CONTENT_MAX_LENGTH + 1) });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it(`acepta exactamente ${FEED_CONTENT_MAX_LENGTH} caracteres`, async () => {
    const app = createFeedApp({ pool: makePool({ rows: [dbRow] }, authorRow), authGuard });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .send({ content: 'A'.repeat(FEED_CONTENT_MAX_LENGTH) });

    expect(res.status).toBe(201);
    expect(FeedCreateResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('un identificador académico no numérico da 400', async () => {
    const app = createFeedApp({ pool: makePool(), authGuard });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .send({ content: 'Hola', faculty_id: 'abc' });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
