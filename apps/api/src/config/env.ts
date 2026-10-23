import { DEFAULT_LOCAL_REDIS_URL } from './redis';

/**
 * Configuración del servidor, validada al arrancar. Los mensajes de error nombran las variables
 * pero nunca muestran sus valores, que pueden contener credenciales.
 */

export type RadarMode = 'local' | 'proxy';

export interface ServerConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  allowedOrigins: string[];
  databaseUrl: string;
  /** Si falta, se usa redis://127.0.0.1:6379 como antes de la etapa 3 (en producción, con aviso). */
  redisUrl: string;
  radar: { mode: 'local' } | { mode: 'proxy'; target: URL; timeoutMs: number };
  warnings: string[];
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuración del servidor inválida:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

export const DEFAULT_ALLOWED_ORIGINS = ['https://social.unsch.edu.pe'];
const LOCAL_ORIGINS = ['http://localhost:3001', 'http://localhost:3000'];
export const DEFAULT_RADAR_PROXY_TIMEOUT_MS = 5000;

type Env = Record<string, string | undefined>;

const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';

const rawModeIsLocal = (env: Env) => !present(env.RADAR_MODE) || env.RADAR_MODE.trim().toLowerCase() === 'local';

/** Misma regla de CORS que antes de la etapa 3: lista explícita o valores por defecto. */
export function resolveAllowedOrigins(env: Env): string[] {
  if (present(env.ALLOWED_ORIGINS)) {
    return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return env.NODE_ENV === 'production' ? [...DEFAULT_ALLOWED_ORIGINS] : [...DEFAULT_ALLOWED_ORIGINS, ...LOCAL_ORIGINS];
}

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function loadServerConfig(env: Env = process.env): ServerConfig {
  const problems: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = present(env.NODE_ENV) ? env.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';

  // Puerto: PORT (inyectado por la plataforma) o APP_PORT; 3000 por defecto.
  const rawPort = present(env.PORT) ? env.PORT : present(env.APP_PORT) ? env.APP_PORT : '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT/APP_PORT debe ser un número de puerto entre 0 y 65535.');
  }

  if (!present(env.DATABASE_URL)) {
    problems.push('DATABASE_URL es obligatoria (cadena de conexión de PostgreSQL).');
  } else if (!hasProtocol(env.DATABASE_URL, ['postgres:', 'postgresql:'])) {
    problems.push('DATABASE_URL debe usar el esquema postgres:// o postgresql://.');
  }

  for (const name of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'] as const) {
    const value = env[name];
    if (!present(value)) {
      problems.push(`${name} es obligatoria (clave RSA en formato PEM).`);
    } else if (!value.includes('-----BEGIN')) {
      problems.push(`${name} no parece una clave PEM (falta la cabecera -----BEGIN ...).`);
    }
  }

  if (isProduction && !present(env.ALLOWED_ORIGINS)) {
    problems.push('ALLOWED_ORIGINS es obligatoria en producción (orígenes del frontend separados por comas).');
  }

  let redisUrl = DEFAULT_LOCAL_REDIS_URL;
  if (present(env.REDIS_URL)) {
    if (!hasProtocol(env.REDIS_URL, ['redis:', 'rediss:'])) {
      problems.push('REDIS_URL debe usar el esquema redis:// o rediss://.');
    } else {
      redisUrl = env.REDIS_URL;
    }
  } else if (isProduction && rawModeIsLocal(env)) {
    // No es fatal: solo el radar depende de Redis y el resto de la API debe seguir atendiendo.
    // Se conserva el destino local por defecto anterior; la readiness mostrará el radar caído.
    warnings.push('REDIS_URL no está definida: el radar local intentará conectar a redis://127.0.0.1:6379 y quedará no disponible.');
  }

  const rawMode = present(env.RADAR_MODE) ? env.RADAR_MODE.trim().toLowerCase() : 'local';
  let radar: ServerConfig['radar'] = { mode: 'local' };
  if (rawMode === 'proxy') {
    let target: URL | null = null;
    if (!present(env.RADAR_PROXY_TARGET)) {
      problems.push('RADAR_PROXY_TARGET es obligatoria cuando RADAR_MODE=proxy.');
    } else {
      try {
        const parsed = new URL(env.RADAR_PROXY_TARGET);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          problems.push('RADAR_PROXY_TARGET debe usar http:// o https://.');
        } else if (parsed.username || parsed.password) {
          problems.push('RADAR_PROXY_TARGET no debe incluir credenciales.');
        } else if (parsed.search || parsed.hash) {
          problems.push('RADAR_PROXY_TARGET no debe incluir query ni fragmento.');
        } else {
          target = parsed;
        }
      } catch {
        problems.push('RADAR_PROXY_TARGET no es una URL válida.');
      }
    }
    const timeoutMs = present(env.RADAR_PROXY_TIMEOUT_MS)
      ? Number(env.RADAR_PROXY_TIMEOUT_MS)
      : DEFAULT_RADAR_PROXY_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
      problems.push('RADAR_PROXY_TIMEOUT_MS debe ser un entero entre 100 y 30000.');
    }
    if (target) radar = { mode: 'proxy', target, timeoutMs };
  } else if (rawMode !== 'local') {
    problems.push("RADAR_MODE debe ser 'local' o 'proxy'.");
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    nodeEnv,
    isProduction,
    port,
    allowedOrigins: resolveAllowedOrigins(env),
    databaseUrl: env.DATABASE_URL as string,
    redisUrl,
    radar,
    warnings,
  };
}
