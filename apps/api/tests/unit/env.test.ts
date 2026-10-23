/**
 * Unit Test Suite: validación de configuración del servidor (src/config/env.ts)
 */

import { ConfigError, loadServerConfig, resolveAllowedOrigins } from '../../src/config/env';

const PEM_PRIV = '-----BEGIN PRIVATE KEY-----\\nficticia\\n-----END PRIVATE KEY-----';
const PEM_PUB = '-----BEGIN PUBLIC KEY-----\\nficticia\\n-----END PUBLIC KEY-----';
const SECRET_DB = 'postgresql://usuario:clave-super-secreta@db.ejemplo.local:5432/social';

const base = {
  DATABASE_URL: SECRET_DB,
  JWT_PRIVATE_KEY: PEM_PRIV,
  JWT_PUBLIC_KEY: PEM_PUB,
};

function problemsOf(env: Record<string, string | undefined>): string[] {
  try {
    loadServerConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  return [];
}

describe('loadServerConfig', () => {
  it('con la configuración mínima de desarrollo usa radar local, puerto 3000 y Redis local', () => {
    const config = loadServerConfig(base);
    expect(config.port).toBe(3000);
    expect(config.radar).toEqual({ mode: 'local' });
    expect(config.redisUrl).toBe('redis://127.0.0.1:6379');
    expect(config.isProduction).toBe(false);
    expect(config.warnings).toEqual([]);
  });

  it('PORT tiene prioridad sobre APP_PORT', () => {
    expect(loadServerConfig({ ...base, PORT: '10000', APP_PORT: '3000' }).port).toBe(10000);
    expect(loadServerConfig({ ...base, APP_PORT: '4000' }).port).toBe(4000);
  });

  it('enumera todas las variables obligatorias que faltan', () => {
    const problems = problemsOf({});
    expect(problems.join('\n')).toMatch(/DATABASE_URL es obligatoria/);
    expect(problems.join('\n')).toMatch(/JWT_PRIVATE_KEY es obligatoria/);
    expect(problems.join('\n')).toMatch(/JWT_PUBLIC_KEY es obligatoria/);
  });

  it('nunca incluye valores de variables en los mensajes de error', () => {
    const error = (() => {
      try {
        loadServerConfig({ ...base, DATABASE_URL: 'mysql://usuario:clave-super-secreta@host/db', JWT_PUBLIC_KEY: 'clave-super-secreta' });
      } catch (e) {
        return e as ConfigError;
      }
      throw new Error('se esperaba ConfigError');
    })();
    expect(error.problems).toHaveLength(2);
    expect(error.message).not.toContain('clave-super-secreta');
  });

  it('valida esquemas de DATABASE_URL y REDIS_URL', () => {
    expect(problemsOf({ ...base, DATABASE_URL: 'no-es-url' })).toEqual([
      'DATABASE_URL debe usar el esquema postgres:// o postgresql://.',
    ]);
    expect(problemsOf({ ...base, REDIS_URL: 'http://cache' })).toEqual(['REDIS_URL debe usar el esquema redis:// o rediss://.']);
    expect(loadServerConfig({ ...base, REDIS_URL: 'rediss://default:x@cache.ejemplo:6379' }).redisUrl).toMatch(/^rediss:/);
  });

  it('rechaza un puerto inválido', () => {
    expect(problemsOf({ ...base, PORT: 'abc' })).toEqual(['PORT/APP_PORT debe ser un número de puerto entre 0 y 65535.']);
  });

  describe('producción', () => {
    const prod = { ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.ejemplo', REDIS_URL: 'rediss://cache:6379' };

    it('exige ALLOWED_ORIGINS', () => {
      expect(problemsOf({ ...prod, ALLOWED_ORIGINS: undefined })).toEqual([
        'ALLOWED_ORIGINS es obligatoria en producción (orígenes del frontend separados por comas).',
      ]);
    });

    it('sin REDIS_URL no detiene la API: avisa y conserva el destino local anterior', () => {
      const config = loadServerConfig({ ...prod, REDIS_URL: undefined });
      expect(config.redisUrl).toBe('redis://127.0.0.1:6379');
      expect(config.warnings).toHaveLength(1);
      expect(config.warnings[0]).toMatch(/REDIS_URL no está definida/);
    });

    it('no avisa por REDIS_URL si el radar está en modo proxy', () => {
      const config = loadServerConfig({ ...prod, REDIS_URL: undefined, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'https://radar.interno' });
      expect(config.warnings).toEqual([]);
    });
  });

  describe('RADAR_MODE', () => {
    it('proxy exige un destino http(s) sin credenciales, query ni fragmento', () => {
      expect(problemsOf({ ...base, RADAR_MODE: 'proxy' })).toEqual(['RADAR_PROXY_TARGET es obligatoria cuando RADAR_MODE=proxy.']);
      expect(problemsOf({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'ftp://radar' })).toEqual([
        'RADAR_PROXY_TARGET debe usar http:// o https://.',
      ]);
      expect(problemsOf({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'https://u:p@radar' })).toEqual([
        'RADAR_PROXY_TARGET no debe incluir credenciales.',
      ]);
      expect(problemsOf({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'https://radar?x=1' })).toEqual([
        'RADAR_PROXY_TARGET no debe incluir query ni fragmento.',
      ]);
      expect(problemsOf({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'no es url' })).toEqual([
        'RADAR_PROXY_TARGET no es una URL válida.',
      ]);
    });

    it('proxy válido con límite de tiempo por defecto y configurable', () => {
      const config = loadServerConfig({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'https://radar.interno/base' });
      expect(config.radar).toEqual({ mode: 'proxy', target: new URL('https://radar.interno/base'), timeoutMs: 5000 });
      const custom = loadServerConfig({ ...base, RADAR_MODE: 'PROXY', RADAR_PROXY_TARGET: 'http://127.0.0.1:4100', RADAR_PROXY_TIMEOUT_MS: '800' });
      expect(custom.radar).toMatchObject({ mode: 'proxy', timeoutMs: 800 });
    });

    it('rechaza límites de tiempo fuera de rango y modos desconocidos', () => {
      expect(
        problemsOf({ ...base, RADAR_MODE: 'proxy', RADAR_PROXY_TARGET: 'http://radar', RADAR_PROXY_TIMEOUT_MS: '50' })
      ).toEqual(['RADAR_PROXY_TIMEOUT_MS debe ser un entero entre 100 y 30000.']);
      expect(problemsOf({ ...base, RADAR_MODE: 'remoto' })).toEqual(["RADAR_MODE debe ser 'local' o 'proxy'."]);
    });
  });
});

describe('resolveAllowedOrigins', () => {
  it('conserva los valores por defecto anteriores a la etapa 3', () => {
    expect(resolveAllowedOrigins({})).toEqual([
      'https://social.unsch.edu.pe',
      'http://localhost:3001',
      'http://localhost:3000',
    ]);
    expect(resolveAllowedOrigins({ NODE_ENV: 'production' })).toEqual(['https://social.unsch.edu.pe']);
  });

  it('usa la lista explícita, ignorando espacios y elementos vacíos', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: 'https://a.example, https://b.example,' })).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});
