/**
 * Contract Test Suite: Feed HTTP (/api/v1/feed) en modo local
 *
 * Comprueba las respuestas reales de la aplicación (createApp + router local de
 * Feed) contra los esquemas de @social-unsch/contracts. El par de este archivo
 * es apps/feed/tests/contract/feed.contract.test.ts, que valida el servicio
 * independiente contra los mismos esquemas: juntos impiden que activar
 * FEED_MODE=proxy cambie lo que ve el cliente.
 *
 * PostgreSQL se sustituye por un pool falso a nivel de módulo; JWT se sustituye
 * como en las demás pruebas de rutas.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import request from 'supertest';
import {
  ErrorResponseSchema,
  FEED_CONTENT_MAX_LENGTH,
  FEED_ERROR_CODES,
  FEED_ROUTES,
  FeedCreateResponseSchema,
  FeedListResponseSchema,
} from '@social-unsch/contracts';
import { pool } from '../../src/config/database';
import { verifyAccessToken } from '../../src/config/jwt';
import { createTestApp } from '../helpers/test-app';

const mockVerify = verifyAccessToken as jest.Mock;
const mockQuery = (pool as unknown as { query: jest.Mock }).query;
const app = createTestApp();

const AUTH = 'Bearer token.de.prueba';
const tokenPayload = {
  jti: 'jti-feed-contract',
  user_id: 'user-feed-contract-0001',
  role: 'student',
  school_id: 1,
  has_accepted_terms: true,
  facultad_id: 1,
  escuela_id: 1,
  ciclo: 3,
};

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

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(tokenPayload);
});

describe(`${FEED_ROUTES.list.method} ${FEED_ROUTES.list.path}`, () => {
  it('cumple FeedListResponseSchema con publicaciones', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app).get(FEED_ROUTES.list.path).set('Authorization', AUTH);

    expect(res.status).toBe(200);
    const parsed = FeedListResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  it('cumple FeedListResponseSchema con lista vacía', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(FEED_ROUTES.list.path).set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(FeedListResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('created_at viaja como texto ISO 8601, no como objeto', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app).get(FEED_ROUTES.list.path).set('Authorization', AUTH);

    expect(typeof res.body.data[0].created_at).toBe('string');
    expect(new Date(res.body.data[0].created_at).toISOString()).toBe('2026-11-25T10:00:00.000Z');
  });

  it('un parámetro no numérico da 400 con el formato de error del contrato', async () => {
    const res = await request(app)
      .get(`${FEED_ROUTES.list.path}?page=abc`)
      .set('Authorization', AUTH);

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });

  it('sin token da 401 con el formato de error del contrato', async () => {
    const res = await request(app).get(FEED_ROUTES.list.path);

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.code in FEED_ERROR_CODES).toBe(true);
  });
});

describe(`${FEED_ROUTES.create.method} ${FEED_ROUTES.create.path}`, () => {
  it('cumple FeedCreateResponseSchema con 201', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [dbRow] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Autor Contrato', role: 'student' }] });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .set('Authorization', AUTH)
      .send({ content: 'Publicación de contrato' });

    expect(res.status).toBe(201);
    expect(FeedCreateResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('contenido vacío da 400 con el formato de error del contrato', async () => {
    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .set('Authorization', AUTH)
      .send({ content: '   ' });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it(`contenido por encima de ${FEED_CONTENT_MAX_LENGTH} caracteres da 400`, async () => {
    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .set('Authorization', AUTH)
      .send({ content: 'A'.repeat(FEED_CONTENT_MAX_LENGTH + 1) });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it(`acepta exactamente ${FEED_CONTENT_MAX_LENGTH} caracteres`, async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [dbRow] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Autor Contrato', role: 'student' }] });

    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .set('Authorization', AUTH)
      .send({ content: 'A'.repeat(FEED_CONTENT_MAX_LENGTH) });

    expect(res.status).toBe(201);
    expect(FeedCreateResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('un identificador académico no numérico da 400', async () => {
    const res = await request(app)
      .post(FEED_ROUTES.create.path)
      .set('Authorization', AUTH)
      .send({ content: 'Hola', faculty_id: 'abc' });

    expect(res.status).toBe(FEED_ERROR_CODES.ERR_VALIDATION_INVALID_FIELDS);
    expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
