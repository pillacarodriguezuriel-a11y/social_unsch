import request from 'supertest';
import {
  ErrorResponseSchema,
  RadarReportPendingSchema,
  RadarReportUpdatedSchema,
  RadarStatusResponseSchema,
} from '@social-unsch/contracts';
import { createRadarApp } from '../../src/app';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';
import { generateTestToken, getTestRsaKeys } from '../helpers/test-keys';

describe('apps/radar - Pruebas de Contrato HTTP (@social-unsch/contracts)', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });
  const token = generateTestToken({ user_id: 'contrato-user-1', role: 'student' });

  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, { status: 'fluid', isDefinite: 'true' }],
          [null, { status: 'empty_window', isDefinite: 'true' }],
          [null, { occupancy: '25', isDefinite: 'true' }],
          [null, { occupancy: '50', isDefinite: 'true' }],
          [null, { occupancy: '0', isDefinite: 'true' }],
          [null, {}], // piso 4 indefinido
          [null, { status: 'cultural_event', isDefinite: 'true' }],
        ]),
      }),
      eval: jest.fn(),
    };
  });

  const app = () => createRadarApp({ redis: mockRedis, authGuard });

  describe('GET /api/v1/radar/status', () => {
    it('cumple estrictamente con RadarStatusResponseSchema', async () => {
      const res = await request(app())
        .get('/api/v1/radar/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const parsed = RadarStatusResponseSchema.parse(res.body);

      expect(parsed.comedor.status).toBe('fluid');
      expect(parsed.comedor.is_definite).toBe(true);
      expect(parsed.rectorado.status).toBe('empty_window');
      expect(parsed.biblioteca.floor_1.occupancy).toBe(25);
      expect(parsed.biblioteca.floor_4.occupancy).toBe('indefinido');
      expect(parsed.biblioteca.floor_4.is_definite).toBe(false);
      expect(parsed.campus_alert.status).toBe('cultural_event');
    });

    it('responde 401 ErrorResponseSchema ante token ausente', async () => {
      const res = await request(app()).get('/api/v1/radar/status');

      expect(res.status).toBe(401);
      const error = ErrorResponseSchema.parse(res.body);
      expect(error.code).toBe('ERR_AUTH_TOKEN_MISSING');
    });
  });

  describe('POST /api/v1/radar/report', () => {
    it('cumple con RadarReportUpdatedSchema cuando el voto consolida el estado (consenso)', async () => {
      mockRedis.eval.mockResolvedValue([1, 3, 'Estado actualizado']);

      const res = await request(app())
        .post('/api/v1/radar/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ node: 'comedor', status: 'fluid' });

      expect(res.status).toBe(200);
      const updated = RadarReportUpdatedSchema.parse(res.body);
      expect(updated.updated).toBe(true);
      expect(updated.current_status).toBe('fluid');
    });

    it('cumple con RadarReportPendingSchema cuando faltan votos', async () => {
      mockRedis.eval.mockResolvedValue([0, 1, 'Reporte registrado, esperando más confirmaciones']);

      const res = await request(app())
        .post('/api/v1/radar/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ node: 'comedor', status: 'fluid' });

      expect(res.status).toBe(200);
      const pending = RadarReportPendingSchema.parse(res.body);
      expect(pending.updated).toBe(false);
      expect(pending.votes_current).toBe(1);
      expect(pending.votes_required).toBe(3);
    });

    it('cumple con ErrorResponseSchema (400) cuando faltan campos requeridos', async () => {
      const res = await request(app())
        .post('/api/v1/radar/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ node: 'comedor' }); // falta status

      expect(res.status).toBe(400);
      const err = ErrorResponseSchema.parse(res.body);
      expect(err.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
    });

    it('cumple con ErrorResponseSchema (400) ante nodo inválido', async () => {
      const res = await request(app())
        .post('/api/v1/radar/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ node: 'nodo_falso', status: 'fluid' });

      expect(res.status).toBe(400);
      const err = ErrorResponseSchema.parse(res.body);
      expect(err.code).toBe('ERR_RADAR_INVALID_NODE');
    });

    it('cumple con ErrorResponseSchema (400) ante status inválido', async () => {
      const res = await request(app())
        .post('/api/v1/radar/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ node: 'comedor', status: 'estado_no_permitido' });

      expect(res.status).toBe(400);
      const err = ErrorResponseSchema.parse(res.body);
      expect(err.code).toBe('ERR_RADAR_INVALID_STATUS');
    });
  });
});
