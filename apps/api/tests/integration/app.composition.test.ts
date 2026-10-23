/**
 * Integration Test Suite: composición de la aplicación (createApp)
 *
 * - El radar se monta en /api/v1/radar desde la unidad recibida: puede sustituirse sin tocar el
 *   resto de rutas ni el frontend.
 * - CORS conserva el comportamiento anterior a la etapa 3.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import { Router } from 'express';
import request from 'supertest';
import { RADAR_MOUNT_PATH } from '../../src/app';
import { RadarModule } from '../../src/modules/radar/radar.module';
import { createTestApp } from '../helpers/test-app';

function stubRadar(): RadarModule {
  const router = Router();
  router.get('/status', (_req, res) => {
    res.status(200).json({ fuente: 'sustituto' });
  });
  return { mode: 'proxy', router, checkReady: async () => true };
}

describe('montaje reemplazable del radar', () => {
  it('se monta en /api/v1/radar', () => {
    expect(RADAR_MOUNT_PATH).toBe('/api/v1/radar');
  });

  it('la unidad recibida atiende /api/v1/radar sin cambiar la URL pública', async () => {
    const res = await request(createTestApp({ radar: stubRadar() })).get('/api/v1/radar/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ fuente: 'sustituto' });
  });

  it('sustituir el radar no altera las demás rutas', async () => {
    const res = await request(createTestApp({ radar: stubRadar() }))
      .post('/api/v1/auth/login')
      .send({ email: 'no-institucional@gmail.com', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_VALIDATION_INVALID_FIELDS');
  });
});

describe('CORS', () => {
  const app = createTestApp({ allowedOrigins: ['https://app.ejemplo'] });

  it('permite un origen configurado', async () => {
    const res = await request(app).get('/health/live').set('Origin', 'https://app.ejemplo');
    expect(res.status).toBe(200);
    const api = await request(app).options('/api/v1/auth/login').set('Origin', 'https://app.ejemplo').set('Access-Control-Request-Method', 'POST');
    expect(api.status).toBe(204);
    expect(api.headers['access-control-allow-origin']).toBe('https://app.ejemplo');
  });

  it('bloquea un origen no configurado como antes (error 500 genérico)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/v1/catalogs').set('Origin', 'https://otro.ejemplo');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ERR_SERVER_INTERNAL_ERROR');
  });

  it('sin lista explícita calcula los orígenes desde el entorno', async () => {
    const res = await request(createTestApp())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://social.unsch.edu.pe')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('https://social.unsch.edu.pe');
  });
});
