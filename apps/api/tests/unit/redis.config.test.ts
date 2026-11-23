jest.mock('ioredis');
import Redis from 'ioredis';
import { createRedisClient, REDIS_COMMAND_TIMEOUT_MS } from '../../src/config/redis';

describe('config/redis - createRedisClient', () => {
  const RedisMock = Redis as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    RedisMock.mockImplementation(() => ({ on: jest.fn() }));
  });

  it('no encola comandos sin conexión y limita cada comando en el tiempo', () => {
    createRedisClient('redis://localhost:6379');
    const [url, options] = RedisMock.mock.calls[0];
    expect(url).toBe('redis://localhost:6379');
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.commandTimeout).toBe(REDIS_COMMAND_TIMEOUT_MS);
    // Debe vencer antes que la comprobación de /health/ready (2 s) y que el proxy (5 s por defecto)
    expect(REDIS_COMMAND_TIMEOUT_MS).toBeLessThan(2000);
  });

  it('reconecta con espera creciente y techo de 3000 ms', () => {
    createRedisClient('redis://localhost:6379');
    const { retryStrategy } = RedisMock.mock.calls[0][1];
    expect(retryStrategy(1)).toBe(100);
    expect(retryStrategy(100)).toBe(3000);
  });

  it('activa TLS solo con el esquema rediss://', () => {
    createRedisClient('rediss://host:6379');
    expect(RedisMock.mock.calls[0][1].tls).toEqual({});
    createRedisClient('redis://host:6379');
    expect(RedisMock.mock.calls[1][1].tls).toBeUndefined();
  });
});
