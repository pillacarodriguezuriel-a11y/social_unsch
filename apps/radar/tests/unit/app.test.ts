import request from 'supertest';
import { createRadarApp } from '../../src/app';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';
import { generateTestToken, getTestRsaKeys } from '../helpers/test-keys';

describe('apps/radar - app.ts & middlewares edge cases', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });
  const token = generateTestToken({ user_id: 'user-app-test' });

  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, {}], [null, {}], [null, {}], [null, {}], [null, {}], [null, {}], [null, {}]
        ]),
      }),
      eval: jest.fn().mockResolvedValue([0, 1, 'ok']),
    };
  });

  it('responde 404 ERR_NOT_FOUND para rutas inexistentes', async () => {
    const app = createRadarApp({
      redis: mockRedis,
      authGuard,
      allowedOrigins: ['http://localhost:3000'],
    });

    const res = await request(app).get('/api/v1/ruta-inexistente');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: true,
      message: 'Ruta no encontrada en el servicio Radar.',
      code: 'ERR_NOT_FOUND',
    });
  });

  it('respeta x-request-id entrante válido y lo propaga en la respuesta', async () => {
    const app = createRadarApp({ redis: mockRedis, authGuard });
    const res = await request(app)
      .get('/health/live')
      .set('x-request-id', 'req-externo-12345');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('req-externo-12345');
  });

  it('el controlador propaga errores inesperados al middleware de error', async () => {
    mockRedis.pipeline.mockReturnValue({
      hgetall: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('Fallo crítico de Redis')),
    });

    const app = createRadarApp({ redis: mockRedis, authGuard });
    const res = await request(app)
      .get('/api/v1/radar/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
  });

  it('responde 401 ERR_AUTH_UNAUTHORIZED si req.user no tiene userId en submitReport', async () => {
    // Guardia personalizado que no define userId
    const dummyGuard = (req: any, _res: any, next: any) => {
      req.user = undefined;
      next();
    };

    const app = createRadarApp({ redis: mockRedis, authGuard: dummyGuard });
    const res = await request(app)
      .post('/api/v1/radar/report')
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_UNAUTHORIZED');
  });

  it('errorMiddleware maneja errores sin statusCode ni code ni message usando valores por defecto', () => {
    const { errorMiddleware } = require('../../src/middlewares/error.middleware');
    const res: any = {
      locals: {},
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    errorMiddleware({}, {} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ERR_SERVER_INTERNAL_ERROR' })
    );
  });
});
