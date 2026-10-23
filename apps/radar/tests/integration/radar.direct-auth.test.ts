import request from 'supertest';
import { createRadarApp } from '../../src/app';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';
import { generateTestToken, getTestRsaKeys } from '../helpers/test-keys';

describe('apps/radar - Frontera de Autenticación y Acceso Directo', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });

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
      eval: jest.fn().mockResolvedValue([0, 1, 'Reporte registrado']),
    };
  });

  const app = () => createRadarApp({ redis: mockRedis, authGuard });

  it('el acceso directo a /api/v1/radar/status sin token responde 401 y no ejecuta operaciones en Redis', async () => {
    const res = await request(app()).get('/api/v1/radar/status');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    expect(mockRedis.pipeline).not.toHaveBeenCalled();
  });

  it('el acceso directo a /api/v1/radar/report sin token responde 401 y no registra votos en Redis', async () => {
    const res = await request(app())
      .post('/api/v1/radar/report')
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_TOKEN_MISSING');
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('el acceso directo con token expirado responde 401 ERR_AUTH_TOKEN_EXPIRED', async () => {
    const expiredToken = generateTestToken({ user_id: 'user-expired' }, -60);

    const res = await request(app())
      .get('/api/v1/radar/status')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_TOKEN_EXPIRED');
  });

  it('el acceso directo con firma corrupta o clave falsa responde 401 ERR_AUTH_INVALID_TOKEN', async () => {
    const res = await request(app())
      .get('/api/v1/radar/status')
      .set('Authorization', 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.falso.invalido');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERR_AUTH_INVALID_TOKEN');
  });

  it('impedir suplantación: el servicio deriva user_id exclusivamente del token válido ignorando x-user-id en la cabecera', async () => {
    const validToken = generateTestToken({ user_id: 'alumno-real-123', role: 'student' });

    const res = await request(app())
      .post('/api/v1/radar/report')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-user-id', 'suplantador-hacker-999')
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(200);

    // Verificar los argumentos pasados al script Lua en Redis
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const evalArgs = mockRedis.eval.mock.calls[0];
    // ARGV[1] es userId
    expect(evalArgs).toContain('alumno-real-123');
    expect(evalArgs).not.toContain('suplantador-hacker-999');
  });
});
