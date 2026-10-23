/**
 * Unit Test Suite: arranque, composición y cierre del proceso (bootstrap.ts, composition.ts)
 */

const mockPool = { query: jest.fn(), end: jest.fn() };
jest.mock('../../src/config/database', () => ({ pool: mockPool }));
jest.mock('../../src/config/jwt', () => ({ signAccessToken: jest.fn(), verifyAccessToken: jest.fn() }));

const mockRedisClient = {
  pipeline: jest.fn(),
  eval: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
};
const mockCreateRedisClient = jest.fn((_url: string) => mockRedisClient);
jest.mock('../../src/config/redis', () => ({
  DEFAULT_LOCAL_REDIS_URL: 'redis://127.0.0.1:6379',
  createRedisClient: (url: string) => mockCreateRedisClient(url),
}));

import request from 'supertest';
import { startServer } from '../../src/bootstrap';
import { createAppResources } from '../../src/composition';
import { loadServerConfig } from '../../src/config/env';

const env = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----x',
  JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----x',
  PORT: '0',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateRedisClient.mockImplementation((_url: string) => mockRedisClient);
  mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
  mockPool.end.mockResolvedValue(undefined);
  mockRedisClient.ping.mockResolvedValue('PONG');
  mockRedisClient.quit.mockResolvedValue('OK');
});

describe('createAppResources', () => {
  it('en modo local crea un único cliente Redis con la URL configurada', () => {
    createAppResources(loadServerConfig({ ...env, REDIS_URL: 'redis://cache.local:6380' }));
    expect(mockCreateRedisClient).toHaveBeenCalledTimes(1);
    expect(mockCreateRedisClient).toHaveBeenCalledWith('redis://cache.local:6380');
  });

  it('en modo proxy no abre Redis', () => {
    const resources = createAppResources(
      loadServerConfig({ ...env, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'http://127.0.0.1:9' })
    );
    expect(mockCreateRedisClient).not.toHaveBeenCalled();
    expect(resources.deps.radar.mode).toBe('proxy');
  });

  it('close() cierra Redis y el pool una sola vez aunque se invoque varias veces', async () => {
    const resources = createAppResources(loadServerConfig(env));
    await Promise.all([resources.close(), resources.close()]);
    expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });

  it('si quit() falla, desconecta Redis y cierra igualmente el pool', async () => {
    mockRedisClient.quit.mockRejectedValueOnce(new Error('Connection is closed.'));
    const resources = createAppResources(loadServerConfig(env));
    await resources.close();
    expect(mockRedisClient.disconnect).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it('las comprobaciones de readiness consultan PostgreSQL y el radar', async () => {
    const { deps } = createAppResources(loadServerConfig(env));
    const [db, radar] = deps.readinessChecks;
    expect(db).toMatchObject({ name: 'database', critical: true });
    expect(radar).toMatchObject({ name: 'radar', critical: false });
    await expect(db.check()).resolves.toBe(true);
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    await expect(radar.check()).resolves.toBe(true);
  });
});

describe('startServer', () => {
  it('escucha, responde a la salud y al detenerse cierra el servidor y las conexiones', async () => {
    const running = await startServer(loadServerConfig(env));
    try {
      expect(running.port).toBeGreaterThan(0);
      const live = await request(`http://127.0.0.1:${running.port}`).get('/health/live');
      expect(live.status).toBe(200);
      const ready = await request(`http://127.0.0.1:${running.port}`).get('/health/ready');
      expect(ready.body).toEqual({ status: 'ready', checks: { database: 'up', radar: 'up' } });
    } finally {
      await running.stop();
    }
    expect(running.server.listening).toBe(false);
    expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    expect(mockPool.end).toHaveBeenCalledTimes(1);
    await running.stop();
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });

  it('si el puerto está ocupado, falla y cierra las conexiones ya creadas', async () => {
    const first = await startServer(loadServerConfig(env));
    try {
      const close = jest.fn().mockResolvedValue(undefined);
      await expect(
        startServer(loadServerConfig({ ...env, PORT: String(first.port) }), () => ({
          deps: createAppResources(loadServerConfig(env)).deps,
          close,
        }))
      ).rejects.toThrow(/EADDRINUSE/);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      await first.stop();
    }
  });
});
