import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface FeedServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  serviceName: string;
  allowedOrigins: string[];
  databaseUrl: string;
  jwtPublicKey: string;
  warnings: string[];
}

export class FeedConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuración inválida en Feed:\n- ${problems.join('\n- ')}`);
    this.name = 'FeedConfigError';
  }
}

export const DEFAULT_FEED_PORT = 4002;
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://social.unsch.edu.pe',
];

type Env = Record<string, string | undefined>;
const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function loadFeedConfig(env: Env = process.env): FeedServerConfig {
  const problems: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = present(env.NODE_ENV) ? env.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';
  const serviceName = present(env.SERVICE_NAME) ? env.SERVICE_NAME : 'social-unsch-feed';

  const rawPort = present(env.PORT) ? env.PORT : present(env.APP_PORT) ? env.APP_PORT : String(DEFAULT_FEED_PORT);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT/APP_PORT debe ser un número de puerto válido (0-65535).');
  }

  if (!present(env.DATABASE_URL)) {
    problems.push('DATABASE_URL es obligatoria (cadena de conexión de PostgreSQL).');
  } else if (!hasProtocol(env.DATABASE_URL, ['postgres:', 'postgresql:'])) {
    problems.push('DATABASE_URL debe usar el esquema postgres:// o postgresql://.');
  }

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

  let allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS];
  if (present(env.ALLOWED_ORIGINS)) {
    allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  } else if (isProduction) {
    warnings.push('ALLOWED_ORIGINS no definida explícitamente en producción; usando orígenes por defecto.');
  }

  if (problems.length > 0) throw new FeedConfigError(problems);

  return {
    port,
    nodeEnv,
    isProduction,
    serviceName,
    allowedOrigins,
    databaseUrl: env.DATABASE_URL as string,
    jwtPublicKey,
    warnings,
  };
}
