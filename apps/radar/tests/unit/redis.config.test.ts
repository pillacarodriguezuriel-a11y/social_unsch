jest.mock('ioredis');
import Redis from 'ioredis';
import { createRadarRedisClient } from '../../src/config/redis';

describe('apps/radar - createRadarRedisClient', () => {
  let mockRedisConstructor: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisConstructor = Redis as unknown as jest.Mock;
    mockRedisConstructor.mockImplementation(() => ({
      on: jest.fn(),
    }));
  });

  it('configura maxRetriesPerRequest: 1 y enableOfflineQueue: false para evitar colas ilimitadas', () => {
    const callbacks: Record<string, Function> = {};
    mockRedisConstructor.mockImplementation(() => ({
      on: jest.fn((event, cb) => {
        callbacks[event] = cb;
      }),
    }));

    createRadarRedisClient('redis://localhost:6379');
    expect(mockRedisConstructor).toHaveBeenCalledTimes(1);

    const [url, options] = mockRedisConstructor.mock.calls[0];
    expect(url).toBe('redis://localhost:6379');
    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.enableOfflineQueue).toBe(false);

    // Ejecutar listeners de eventos para cobertura
    callbacks['connect']?.();
    callbacks['ready']?.();
    callbacks['error']?.(new Error('fallo'));
    callbacks['close']?.();
    callbacks['reconnecting']?.(200);
  });

  it('implementa retryStrategy con reconexión resiliente y techo en 3000ms', () => {
    createRadarRedisClient('redis://localhost:6379');
    const [, options] = mockRedisConstructor.mock.calls[0];

    const strategy = options.retryStrategy;
    expect(strategy(1)).toBe(100);
    expect(strategy(5)).toBe(500);
    expect(strategy(10)).toBe(1000);
    expect(strategy(30)).toBe(3000);
    expect(strategy(50)).toBe(3000); // capped at 3000
    // No retorna null tras 5 intentos, permitiendo recuperarse de caídas
    expect(strategy(6)).not.toBeNull();
  });

  it('activa TLS cuando la URL inicia con rediss://', () => {
    createRadarRedisClient('rediss://upstash.cloud:6379');
    const [, options] = mockRedisConstructor.mock.calls[0];
    expect(options.tls).toBeDefined();
  });
});
