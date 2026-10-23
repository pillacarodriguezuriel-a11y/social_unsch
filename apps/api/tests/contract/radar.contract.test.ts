/**
 * Contract Test Suite: Radar HTTP (/api/v1/radar)
 *
 * Comprueba las respuestas reales de la aplicación (createApp + módulo local de radar) contra los
 * esquemas de @social-unsch/contracts. Redis se sustituye por un cliente falso inyectado; JWT se
 * sustituye a nivel de módulo como en las demás pruebas de rutas.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import request from 'supertest';
import {
  ErrorResponseSchema,
  RADAR_CAMPUS_ALERT_STATUSES,
  RADAR_COMEDOR_STATUSES,
  RADAR_ERROR_CODES,
  RADAR_NODES,
  RADAR_RECTORADO_STATUSES,
  RADAR_ROUTES,
  RADAR_VOTE_THRESHOLD,
  RadarReportPendingSchema,
  RadarReportRequestSchema,
  RadarReportResponseSchema,
  RadarReportUpdatedSchema,
  RadarStatusResponseSchema,
} from '@social-unsch/contracts';
import { verifyAccessToken } from '../../src/config/jwt';
import { createFakeRedis, createTestApp } from '../helpers/test-app';

const mockVerify = verifyAccessToken as jest.Mock;
const redis = createFakeRedis();
const app = createTestApp({ redis });

const AUTH = 'Bearer token.de.prueba';
const tokenPayload = {
  jti: 'jti-contract',
  user_id: 'user-contract-0001',
  role: 'student',
  school_id: 1,
  has_accepted_terms: true,
  facultad_id: 1,
  escuela_id: 1,
  ciclo: 3,
};

type HashResult = [null, Record<string, string> | null];

function mockStatusHashes(hashes: Array<Record<string, string> | null>) {
  const results: HashResult[] = hashes.map((h) => [null, h]);
  redis.pipeline.mockReturnValue({
    hgetall: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(results),
  });
}

function expectError(body: unknown, status: number, code: keyof typeof RADAR_ERROR_CODES) {
  expect(ErrorResponseSchema.parse(body).code).toBe(code);
  expect(RADAR_ERROR_CODES[code]).toBe(status);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(tokenPayload);
});

describe(`${RADAR_ROUTES.status.method} ${RADAR_ROUTES.status.path}`, () => {
  it('sin estados vigentes devuelve todos los nodos como indefinidos y cumple el contrato', async () => {
    mockStatusHashes([null, {}, null, null, null, null, null]);

    const res = await request(app).get(RADAR_ROUTES.status.path).set('Authorization', AUTH);

    expect(res.status).toBe(200);
    const body = RadarStatusResponseSchema.parse(res.body);
    expect(body.comedor).toEqual({ status: 'indefinido', is_definite: false });
    expect(body.biblioteca.floor_1).toEqual({ occupancy: 'indefinido', is_definite: false });
  });

  it('con estados publicados devuelve textos y aforos numéricos que cumplen el contrato', async () => {
    mockStatusHashes([
      { status: 'fluid', report_count: '3', last_updated: '1760000000' },
      { status: 'collapsed', report_count: '4', last_updated: '1760000000' },
      { occupancy: '25', report_count: '3', last_updated: '1760000000' },
      null,
      { occupancy: '80', report_count: '3', last_updated: '1760000000' },
      null,
      { status: 'lost_item_dni', report_count: '3', last_updated: '1760000000' },
    ]);

    const res = await request(app).get(RADAR_ROUTES.status.path).set('Authorization', AUTH);

    expect(res.status).toBe(200);
    const body = RadarStatusResponseSchema.parse(res.body);
    expect(body.comedor).toEqual({ status: 'fluid', is_definite: true });
    expect(body.biblioteca.floor_1).toEqual({ occupancy: 25, is_definite: true });
    expect(body.biblioteca.floor_3.occupancy).toBe(80);
    expect(body.campus_alert.status).toBe('lost_item_dni');
  });

  it('sin token responde 401 ERR_AUTH_TOKEN_MISSING con el formato de error', async () => {
    const res = await request(app).get(RADAR_ROUTES.status.path);
    expect(res.status).toBe(401);
    expectError(res.body, 401, 'ERR_AUTH_TOKEN_MISSING');
  });

  it('con token inválido responde 401 ERR_AUTH_INVALID_TOKEN', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const res = await request(app).get(RADAR_ROUTES.status.path).set('Authorization', AUTH);
    expect(res.status).toBe(401);
    expectError(res.body, 401, 'ERR_AUTH_INVALID_TOKEN');
  });

  it('si Redis falla responde 500 ERR_SERVER_INTERNAL_ERROR sin detalles internos', async () => {
    redis.pipeline.mockReturnValue({
      hgetall: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get(RADAR_ROUTES.status.path).set('Authorization', AUTH);

    expect(res.status).toBe(500);
    expectError(res.body, 500, 'ERR_SERVER_INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });
});

describe(`${RADAR_ROUTES.report.method} ${RADAR_ROUTES.report.path}`, () => {
  it('al completar el consenso responde updated=true según el contrato', async () => {
    redis.eval.mockResolvedValue([1, RADAR_VOTE_THRESHOLD, 'Estado actualizado']);
    const payload = RadarReportRequestSchema.parse({ node: 'comedor', status: 'fluid' });

    const res = await request(app).post(RADAR_ROUTES.report.path).set('Authorization', AUTH).send(payload);

    expect(res.status).toBe(200);
    const body = RadarReportUpdatedSchema.parse(res.body);
    expect(body.current_status).toBe('fluid');
  });

  it('si faltan votos responde updated=false con votes_current y votes_required', async () => {
    redis.eval.mockResolvedValue([0, 1, 'Reporte registrado, esperando más confirmaciones']);

    const res = await request(app)
      .post(RADAR_ROUTES.report.path)
      .set('Authorization', AUTH)
      .send({ node: 'biblioteca_floor_2', status: '50' });

    expect(res.status).toBe(200);
    const body = RadarReportPendingSchema.parse(res.body);
    expect(body).toMatchObject({ votes_current: 1, votes_required: RADAR_VOTE_THRESHOLD });
  });

  it('un voto repetido responde 200 pendiente con votes_current 0 (comportamiento vigente)', async () => {
    redis.eval.mockResolvedValue([0, -1, 'Ya reportaste este estado en la ventana actual']);

    const res = await request(app)
      .post(RADAR_ROUTES.report.path)
      .set('Authorization', AUTH)
      .send({ node: 'rectorado', status: 'waiting_15' });

    expect(res.status).toBe(200);
    expect(RadarReportResponseSchema.parse(res.body)).toMatchObject({ updated: false, votes_current: 0 });
  });

  it('identifica al votante con el user_id del token, no con datos del cuerpo', async () => {
    redis.eval.mockResolvedValue([0, 1, 'ok']);

    await request(app)
      .post(RADAR_ROUTES.report.path)
      .set('Authorization', AUTH)
      .send({ node: 'comedor', status: 'fluid', user_id: 'otro-usuario' });

    const evalArgs = redis.eval.mock.calls[0];
    expect(evalArgs).toContain(tokenPayload.user_id);
    expect(evalArgs).not.toContain('otro-usuario');
  });

  it.each([
    [{}, 'ERR_VALIDATION_INVALID_FIELDS'],
    [{ node: 'comedor' }, 'ERR_VALIDATION_INVALID_FIELDS'],
    [{ node: 'gimnasio', status: 'fluid' }, 'ERR_RADAR_INVALID_NODE'],
    [{ node: 'comedor', status: 'lleno' }, 'ERR_RADAR_INVALID_STATUS'],
    [{ node: 'biblioteca_floor_1', status: '120' }, 'ERR_RADAR_INVALID_STATUS'],
  ] as const)('cuerpo %j responde 400 %s', async (payload, code) => {
    const res = await request(app).post(RADAR_ROUTES.report.path).set('Authorization', AUTH).send(payload);
    expect(res.status).toBe(400);
    expectError(res.body, 400, code);
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('sin token responde 401 y no registra el voto', async () => {
    const res = await request(app).post(RADAR_ROUTES.report.path).send({ node: 'comedor', status: 'fluid' });
    expect(res.status).toBe(401);
    expectError(res.body, 401, 'ERR_AUTH_TOKEN_MISSING');
    expect(redis.eval).not.toHaveBeenCalled();
  });
});

describe('valores declarados en el contrato', () => {
  it('la API acepta todos los nodos y estados que el contrato declara', async () => {
    redis.eval.mockResolvedValue([0, 1, 'ok']);
    const cases: Array<[string, readonly string[]]> = [
      ['comedor', RADAR_COMEDOR_STATUSES],
      ['rectorado', RADAR_RECTORADO_STATUSES],
      ['campus_alert', RADAR_CAMPUS_ALERT_STATUSES],
      ['biblioteca_floor_4', ['0', '100']],
    ];
    for (const [node, statuses] of cases) {
      for (const status of statuses) {
        const res = await request(app).post(RADAR_ROUTES.report.path).set('Authorization', AUTH).send({ node, status });
        expect(res.status).toBe(200);
      }
    }
    expect(RADAR_NODES).toHaveLength(7);
  });
});
