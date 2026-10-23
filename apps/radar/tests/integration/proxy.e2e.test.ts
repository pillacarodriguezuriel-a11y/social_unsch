import http, { Server } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import express, { Application } from 'express';
import { createRadarApp } from '../../src/app';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';
import { generateTestToken, getTestRsaKeys } from '../helpers/test-keys';
import { RADAR_ERROR_CODES } from '@social-unsch/contracts';

// Simulamos la API principal en modo proxy conectada al servicio Radar real
function createTestProxyApi(radarTargetUrl: URL, timeoutMs = 1000): Application {
  const app = express();
  app.use(express.json());

  // Proxy inverso montado en /api/v1/radar que reenvía a radarTargetUrl
  app.all('/api/v1/radar*', async (req, res) => {
    const targetUrl = new URL(radarTargetUrl.href);
    targetUrl.pathname = req.path;
    targetUrl.search = new URL(req.url, 'http://localhost').search;

    const headers: Record<string, string> = {};
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string;
    if (req.headers['x-request-id']) headers['x-request-id'] = req.headers['x-request-id'] as string;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });

      const payload = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);
      res.send(payload);
    } catch (err: any) {
      if (controller.signal.aborted) {
        res.status(RADAR_ERROR_CODES.ERR_RADAR_UPSTREAM_TIMEOUT).json({
          error: true,
          message: 'El servicio de radar no respondió a tiempo. Inténtelo más tarde.',
          code: 'ERR_RADAR_UPSTREAM_TIMEOUT',
        });
        return;
      }
      res.status(RADAR_ERROR_CODES.ERR_RADAR_UPSTREAM_UNAVAILABLE).json({
        error: true,
        message: 'El servicio de radar no está disponible. Inténtelo más tarde.',
        code: 'ERR_RADAR_UPSTREAM_UNAVAILABLE',
      });
    } finally {
      clearTimeout(timer);
    }
  });

  // Ruta independiente de la API (catálogos) para comprobar que sigue funcionando si Radar cae
  app.get('/api/v1/catalogs', (_req, res) => {
    res.status(200).json({ faculties: [{ id: 1, name: 'Ingeniería' }] });
  });

  return app;
}

describe('apps/radar - Prueba E2E Proxy API -> Servicio Radar Real sobre HTTP', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });
  const token = generateTestToken({ user_id: 'e2e-user-1', role: 'student' });

  let radarServer: Server;
  let radarUrl: URL;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, { status: 'fluid', isDefinite: 'true' }],
          [null, { status: 'empty_window', isDefinite: 'true' }],
          [null, { occupancy: '30', isDefinite: 'true' }],
          [null, { occupancy: '60', isDefinite: 'true' }],
          [null, { occupancy: '10', isDefinite: 'true' }],
          [null, {}],
          [null, { status: 'cultural_event', isDefinite: 'true' }],
        ]),
      }),
      eval: jest.fn().mockResolvedValue([1, 3, 'Estado actualizado']),
    };

    const radarApp = createRadarApp({ redis: mockRedis, authGuard });
    radarServer = http.createServer(radarApp);

    await new Promise<void>((resolve) => radarServer.listen(0, '127.0.0.1', resolve));
    radarUrl = new URL(`http://127.0.0.1:${(radarServer.address() as AddressInfo).port}`);
  });

  afterEach(async () => {
    radarServer.closeAllConnections?.();
    await new Promise<void>((resolve) => radarServer.close(() => resolve()));
  });

  it('GET /api/v1/radar/status se reenvía por la API y es respondido exitosamente por el servicio Radar', async () => {
    const apiApp = createTestProxyApi(radarUrl);
    const res = await request(apiApp)
      .get('/api/v1/radar/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.comedor.status).toBe('fluid');
    expect(res.body.biblioteca.floor_1.occupancy).toBe(30);
    expect(res.body.campus_alert.status).toBe('cultural_event');
  });

  it('POST /api/v1/radar/report se reenvía por la API y registra el voto en el servicio Radar', async () => {
    const apiApp = createTestProxyApi(radarUrl);
    const res = await request(apiApp)
      .post('/api/v1/radar/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.current_status).toBe('fluid');
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
  });

  it('si Radar no responde a tiempo, la API devuelve 504 ERR_RADAR_UPSTREAM_TIMEOUT', async () => {
    // Timeout muy corto para provocar timeout
    const apiApp = createTestProxyApi(radarUrl, 1);
    mockRedis.eval.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([1, 3, 'ok']), 200))
    );

    const res = await request(apiApp)
      .post('/api/v1/radar/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ node: 'comedor', status: 'fluid' });

    expect(res.status).toBe(504);
    expect(res.body.code).toBe('ERR_RADAR_UPSTREAM_TIMEOUT');
  });

  it('si el servicio Radar está apagado o inaccesible, la API devuelve 502 ERR_RADAR_UPSTREAM_UNAVAILABLE', async () => {
    // Cerramos el servidor Radar
    radarServer.closeAllConnections?.();
    await new Promise<void>((resolve) => radarServer.close(() => resolve()));

    const apiApp = createTestProxyApi(radarUrl);
    const res = await request(apiApp)
      .get('/api/v1/radar/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ERR_RADAR_UPSTREAM_UNAVAILABLE');
  });

  it('la caída de Radar no bloquea los módulos independientes de la API (continuidad operativa)', async () => {
    // Apagamos Radar por completo
    radarServer.closeAllConnections?.();
    await new Promise<void>((resolve) => radarServer.close(() => resolve()));

    const apiApp = createTestProxyApi(radarUrl);

    // Radar falla con 502
    const radarRes = await request(apiApp).get('/api/v1/radar/status');
    expect(radarRes.status).toBe(502);

    // Pero Catálogos sigue respondiendo 200 normalmente
    const catRes = await request(apiApp).get('/api/v1/catalogs');
    expect(catRes.status).toBe(200);
    expect(catRes.body.faculties).toBeDefined();
  });
});
