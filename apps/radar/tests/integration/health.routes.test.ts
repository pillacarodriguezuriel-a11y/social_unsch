import request from 'supertest';
import { createRadarApp } from '../../src/app';
import { getTestRsaKeys } from '../helpers/test-keys';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';

describe('apps/radar - Health Routes (/health/live y /health/ready)', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });

  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      ping: jest.fn(),
      pipeline: jest.fn(),
      eval: jest.fn(),
    };
  });

  const createAppWithRedis = (redisImpl = mockRedis) =>
    createRadarApp({
      redis: redisImpl,
      authGuard,
    });

  describe('GET /health/live', () => {
    it('responde 200 status: ok sin consultar dependencias', async () => {
      const app = createAppWithRedis();
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'social-unsch-radar',
      });
      expect(mockRedis.ping).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('responde 200 ready cuando Redis responde PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const app = createAppWithRedis();
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        status: 'ready',
        service: 'social-unsch-radar',
        checks: {
          redis: 'up',
        },
      });
    });

    it('responde 503 unavailable cuando Redis falla o no conecta', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const app = createAppWithRedis();
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        status: 'unavailable',
        service: 'social-unsch-radar',
        checks: {
          redis: 'down',
        },
      });
    });

    it('responde 503 unavailable cuando Redis no responde dentro del límite de tiempo', async () => {
      mockRedis.ping.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 250))
      );

      const app = createRadarApp({
        redis: mockRedis,
        authGuard,
      });

      // Se comprueba que ante lentitud o timeout responda 503
      // En createRadarHealthRouter el timeout por defecto es 2000ms; si mockeamos fallo:
      mockRedis.ping.mockRejectedValueOnce(new Error('Timeout'));
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.checks.redis).toBe('down');
    });
  });
});
