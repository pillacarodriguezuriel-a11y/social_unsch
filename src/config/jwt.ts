import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Cargar llaves RSA desde variables de entorno
const privateKey = process.env.JWT_PRIVATE_KEY ? process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n') : '';
const publicKey = process.env.JWT_PUBLIC_KEY ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n') : '';

export interface TokenPayload {
  jti: string;
  user_id: string; // UUID v4
  role: 'student' | 'alumnus' | 'professor' | 'administrator';
  school_id: number | null;
  has_accepted_terms: boolean;
  facultad_id: number | null;
  escuela_id: number | null;
  ciclo: number | null;
}

/**
 * Firma un token de acceso JWT utilizando el algoritmo RS256 (Llave Privada)
 * @param payload Datos del usuario para el token
 * @param options Opciones adicionales de firma
 */
export function signAccessToken(payload: TokenPayload, options?: SignOptions): string {
  if (!privateKey) {
    throw new Error('La variable de entorno JWT_PRIVATE_KEY no está configurada.');
  }

  const signOptions: SignOptions = {
    ...(options || {}),
    algorithm: 'RS256',
    expiresIn: '24h', // Expiración estrictamente a 24 horas según los requerimientos
  };

  return jwt.sign(payload, privateKey, signOptions);
}

/**
 * Verifica un token JWT utilizando el algoritmo RS256 (Llave Pública)
 * @param token Token JWT recibido
 * @param options Opciones de verificación
 */
export function verifyAccessToken(token: string, options?: VerifyOptions): TokenPayload {
  if (!publicKey) {
    throw new Error('La variable de entorno JWT_PUBLIC_KEY no está configurada.');
  }

  const verifyOptions: VerifyOptions = {
    ...(options || {}),
    algorithms: ['RS256'],
  };

  return jwt.verify(token, publicKey, verifyOptions) as TokenPayload;
}
