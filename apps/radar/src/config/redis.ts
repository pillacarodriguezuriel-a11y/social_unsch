import Redis, { RedisOptions } from 'ioredis';

/**
 * Crea el cliente Redis para el servicio Radar con estrategias de recuperación y límites seguros.
 * 
 * Mejoras ante la deuda técnica previa:
 * - maxRetriesPerRequest: 1 -> Las operaciones individuales fallan rápidamente ante corte, sin encolarse eternamente.
 * - enableOfflineQueue: false -> Evita que peticiones acumuladas durante una caída se ejecuten de golpe tras reconectar (evita votos duplicados).
 * - retryStrategy: backoff exponencial con techo (hasta 3000ms), permitiendo la recuperación tras caídas temporales sin límite arbitrario de 5 intentos.
 */
export function createRadarRedisClient(url: string, customOptions: Partial<RedisOptions> = {}): Redis {
  const isTls = url.startsWith('rediss://');

  const options: RedisOptions = {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // Reconexión resiliente: backoff de 100ms, 200ms, ... hasta un máximo de 3000ms
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    tls: isTls ? {} : undefined,
    ...customOptions,
  };

  const client = new Redis(url, options);

  client.on('connect', () => {
    // Registro limpio sin volcar URLs ni credenciales
    console.log('[Radar-Redis]: Conexión establecida con el servidor Redis.');
  });

  client.on('ready', () => {
    console.log('[Radar-Redis]: Cliente listo para procesar comandos.');
  });

  client.on('error', (err: Error) => {
    console.error('[Radar-Redis]: Error de conexión en Redis:', err.message);
  });

  client.on('close', () => {
    console.warn('[Radar-Redis]: Conexión cerrada con el servidor Redis.');
  });

  client.on('reconnecting', (time: number) => {
    console.log(`[Radar-Redis]: Reintentando conexión en ${time}ms...`);
  });

  return client;
}
