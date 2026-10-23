import { loadRadarConfig, RadarConfigError, DEFAULT_RADAR_PORT, DEFAULT_REDIS_URL } from '../../src/config/env';
import { getTestRsaKeys } from '../helpers/test-keys';

describe('apps/radar - loadRadarConfig', () => {
  const { publicKey } = getTestRsaKeys();

  const validEnv = {
    PORT: '4001',
    NODE_ENV: 'test',
    JWT_PUBLIC_KEY: publicKey,
    REDIS_URL: 'redis://127.0.0.1:6379',
    ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  };

  it('carga configuración válida correctamente', () => {
    const config = loadRadarConfig(validEnv);
    expect(config.port).toBe(4001);
    expect(config.nodeEnv).toBe('test');
    expect(config.isProduction).toBe(false);
    expect(config.redisUrl).toBe('redis://127.0.0.1:6379');
    expect(config.jwtPublicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(config.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(config.warnings).toHaveLength(0);
  });

  it('usa puerto y redis por defecto cuando se omiten en desarrollo', () => {
    const config = loadRadarConfig({
      NODE_ENV: 'development',
      JWT_PUBLIC_KEY: publicKey,
    });
    expect(config.port).toBe(DEFAULT_RADAR_PORT);
    expect(config.redisUrl).toBe(DEFAULT_REDIS_URL);
  });

  it('falla si falta JWT_PUBLIC_KEY', () => {
    expect(() =>
      loadRadarConfig({
        PORT: '4001',
        NODE_ENV: 'test',
      })
    ).toThrow(RadarConfigError);
  });

  it('falla si JWT_PUBLIC_KEY no parece una clave PEM', () => {
    expect(() =>
      loadRadarConfig({
        JWT_PUBLIC_KEY: 'clave-invalida-no-pem',
      })
    ).toThrow(/no parece una clave PEM/);
  });

  it('falla si PORT no es un número válido', () => {
    expect(() =>
      loadRadarConfig({
        PORT: 'invalido',
        JWT_PUBLIC_KEY: publicKey,
      })
    ).toThrow(/número de puerto válido/);
  });

  it('falla si REDIS_URL no usa esquema redis:// o rediss://', () => {
    expect(() =>
      loadRadarConfig({
        JWT_PUBLIC_KEY: publicKey,
        REDIS_URL: 'http://localhost:6379',
      })
    ).toThrow(/esquema redis:\/\/ o rediss:\/\//);
  });

  it('emite advertencias en producción si falta REDIS_URL o ALLOWED_ORIGINS', () => {
    const config = loadRadarConfig({
      NODE_ENV: 'production',
      JWT_PUBLIC_KEY: publicKey,
    });
    expect(config.isProduction).toBe(true);
    expect(config.warnings.some((w) => w.includes('REDIS_URL'))).toBe(true);
    expect(config.warnings.some((w) => w.includes('ALLOWED_ORIGINS'))).toBe(true);
  });

  it('no expone valores de secretos en el mensaje de error', () => {
    try {
      loadRadarConfig({
        PORT: '999999',
        JWT_PUBLIC_KEY: 'clave_invalida_secreta_12345',
        REDIS_URL: 'http://user:password_super_secreta@host:6379',
      });
      fail('Debió lanzar RadarConfigError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(RadarConfigError);
      expect(err.message).not.toContain('password_super_secreta');
      expect(err.message).not.toContain('clave_invalida_secreta_12345');
    }
  });
});
