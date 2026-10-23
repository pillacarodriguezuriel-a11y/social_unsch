import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface RadarAuthOptions {
  jwtPublicKey: string;
}

/**
 * Middleware de autenticación y frontera de confianza para el servicio Radar.
 * 
 * Reglas de seguridad:
 * 1. Verifica estrictamente la firma RSA (RS256) usando la clave pública proporcionada por el emisor.
 * 2. Deriva la identidad EXCLUSIVAMENTE del token validado (user_id).
 * 3. NUNCA confía en cabeceras de identidad externas (x-user-id, x-role) enviadas por clientes o proxy.
 * 4. Mantiene los códigos de error compatibles con el contrato público de SOCIAL-UNSCH.
 */
export function createRadarAuthGuard({ jwtPublicKey }: RadarAuthOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.locals.errorCode = 'ERR_AUTH_TOKEN_MISSING';
        res.status(401).json({
          error: true,
          message: 'Acceso denegado. No se proporcionó un token de autorización.',
          code: 'ERR_AUTH_TOKEN_MISSING',
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.locals.errorCode = 'ERR_AUTH_INVALID_TOKEN';
        res.status(401).json({
          error: true,
          message: 'El formato del token de autorización no es válido. Utilice Bearer [token].',
          code: 'ERR_AUTH_INVALID_TOKEN',
        });
        return;
      }

      const token = parts[1];

      try {
        const decoded = jwt.verify(token, jwtPublicKey, { algorithms: ['RS256'] }) as JwtPayload & {
          user_id?: string;
          role?: string;
        };

        if (!decoded || typeof decoded.user_id !== 'string') {
          res.locals.errorCode = 'ERR_AUTH_INVALID_TOKEN';
          res.status(401).json({
            error: true,
            message: 'El token de acceso no contiene una identidad de usuario válida.',
            code: 'ERR_AUTH_INVALID_TOKEN',
          });
          return;
        }

        // La identidad proviene ÚNICAMENTE de la firma criptográfica verificada
        req.user = {
          userId: decoded.user_id,
          role: decoded.role || 'student',
        };

        next();
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          res.locals.errorCode = 'ERR_AUTH_TOKEN_EXPIRED';
          res.status(401).json({
            error: true,
            message: 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión.',
            code: 'ERR_AUTH_TOKEN_EXPIRED',
          });
          return;
        }

        res.locals.errorCode = 'ERR_AUTH_INVALID_TOKEN';
        res.status(401).json({
          error: true,
          message: 'El token de autorización es inválido o ha sido manipulado.',
          code: 'ERR_AUTH_INVALID_TOKEN',
        });
      }
    } catch (err) {
      next(err);
    }
  };
}
