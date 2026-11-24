import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface FeedAuthUser {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: FeedAuthUser;
    }
  }
}

export interface FeedAuthOptions {
  jwtPublicKey: string;
}

/**
 * Middleware de autenticación del servicio Feed.
 *
 * Reglas de seguridad:
 * 1. Verifica la firma RS256 con la clave pública configurada en el servidor.
 * 2. Extrae la identidad EXCLUSIVAMENTE del payload del token verificado (user_id).
 * 3. NUNCA confía en cabeceras x-user-id ni x-role enviadas por clientes o proxy.
 * 4. Responde con los mismos códigos de error del contrato público de SOCIAL-UNSCH.
 */
export function createFeedAuthGuard({ jwtPublicKey }: FeedAuthOptions) {
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
