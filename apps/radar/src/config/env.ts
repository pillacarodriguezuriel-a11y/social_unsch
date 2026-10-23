import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno: primero apps/radar/.env y de respaldo la raíz
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface RadarServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  serviceName: string;
  allowedOrigins: string[];
  redisUrl: string;
  jwtPublicKey: string;
  warnings: string[];
}

export class RadarConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuración inválida en Radar:\n- ${problems.join('\n- ')}`);
    this.name = 'RadarConfigError';
  }
}

export const DEFAULT_RADAR_PORT = 4001;
export const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'https://social.unsch.edu.pe'];

type Env = Record<string, string | undefined>;

const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function loadRadarConfig(env: Env = process.env): RadarServerConfig {
  const problems: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = present(env.NODE_ENV) ? env.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';
  const serviceName = present(env.SERVICE_NAME) ? env.SERVICE_NAME : 'social-unsch-radar';

  // Puerto: PORT (Render/plataforma) o APP_PORT; 4001 por defecto
  const rawPort = present(env.PORT) ? env.PORT : present(env.APP_PORT) ? env.APP_PORT : String(DEFAULT_RADAR_PORT);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT/APP_PORT debe ser un número de puerto válido (0-65535).');
  }

  // Clave pública JWT (RS256): el servicio Radar NO necesita ni debe tener la clave privada
  const rawJwtKey = env.JWT_PUBLIC_KEY;
  let jwtPublicKey = '';
  if (!present(rawJwtKey)) {
    problems.push('JWT_PUBLIC_KEY es obligatoria (clave pública RSA en formato PEM para verificar tokens).');
  } else {
    jwtPublicKey = rawJwtKey.replace(/\\n/g, '\n');
    if (!jwtPublicKey.includes('-----BEGIN')) {
      problems.push('JWT_PUBLIC_KEY no parece una clave PEM (falta la cabecera -----BEGIN ...).');
    }
  }

  // Redis
  let redisUrl = DEFAULT_REDIS_URL;
  if (present(env.REDIS_URL)) {
    if (!hasProtocol(env.REDIS_URL, ['redis:', 'rediss:'])) {
      problems.push('REDIS_URL debe usar el esquema redis:// o rediss://.');
    } else {
      redisUrl = env.REDIS_URL;
    }
  } else if (isProduction) {
    warnings.push('REDIS_URL no está definida en producción; se intentará conectar al destino local predeterminado.');
  }

  // CORS
  let allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS];
  if (present(env.ALLOWED_ORIGINS)) {
    allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  } else if (isProduction) {
    warnings.push('ALLOWED_ORIGINS no definida explícitamente en producción; usando orígenes por defecto.');
  }

  if (problems.length > 0) {
    throw new RadarConfigError(problems);
  }

  return {
    port,
    nodeEnv,
    isProduction,
    serviceName,
    allowedOrigins,
    redisUrl,
    jwtPublicKey,
    warnings,
  };
}
