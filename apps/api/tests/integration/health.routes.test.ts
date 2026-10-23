/**
 * Integration Test Suite: comprobaciones de salud (/health/live, /health/ready)
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

import request from 'supertest';
import express from 'express';
import { createHealthRouter, DependencyCheck } from '../../src/health/health.routes';
import { createLocalRadarModule } from '../../src/modules/radar/radar.module';
import { createFakeRedis, createTestApp } from '../helpers/test-app';

const check = (name: string, critical: boolean, result: boolean | Error | 'hang'): DependencyCheck => ({
  name,
  critical,
  check: () =>
    result === 'hang'
      ? new Promise<boolean>(() => undefined)
      : result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result),
});

describe('GET /health/live', () => {
  it('responde 200 sin consultar dependencias', async () => {
    const dep = { name: 'database', critical: true, check: jest.fn() };
    const res = await request(createTestApp({ readinessChecks: [dep] })).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(dep.check).not.toHaveBeenCalled();
  });

  it('no exige cabecera Origin ni se ve afectado por CORS', async () => {
    const res = await request(createTestApp()).get('/health/live').set('Origin', 'https://desconocido.example');
    expect(res.status).toBe(200);
  });
});

describe('GET /health/ready', () => {
  it('200 ready cuando todas las dependencias responden', async () => {
    const app = createTestApp({ readinessChecks: [check('database', true, true), check('radar', false, true)] });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up', radar: 'up' } });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('200 degraded si solo cae el radar: el resto de la API sigue atendiendo', async () => {
    const app = createTestApp({ readinessChecks: [check('database', true, true), check('radar', false, false)] });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'up', radar: 'down' } });
  });

  it('503 unavailable si cae PostgreSQL, sin exponer el error', async () => {
    const app = createTestApp({
      readinessChecks: [
        check('database', true, new Error('password authentication failed for user "admin" at db.secret.host')),
        check('radar', false, true),
      ],
    });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', checks: { database: 'down', radar: 'up' } });
    expect(JSON.stringify(res.body)).not.toMatch(/password|secret|admin/);
  });

  it('una dependencia que no responde se marca caída al vencer el límite de tiempo', async () => {
    const app = express();
    app.use('/health', createHealthRouter([check('database', true, 'hang'), check('radar', false, true)], 50));
    const started = Date.now();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ database: 'down', radar: 'up' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('la comprobación del radar local usa PING sobre el cliente inyectado', async () => {
    const redis = createFakeRedis();
    const radar = createLocalRadarModule({ redis: redis as never });
    await expect(radar.checkReady()).resolves.toBe(true);
    redis.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(radar.checkReady()).resolves.toBe(false);
    redis.ping.mockResolvedValueOnce('LOADING');
    await expect(radar.checkReady()).resolves.toBe(false);
  });
});
