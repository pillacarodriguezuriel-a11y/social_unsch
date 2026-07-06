import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../config/jwt';
import { AppError } from '../shared/errors/AppError';

// Extender la interfaz Request de Express de forma global o local para soportar req.user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware de seguridad (AuthGuard) que protege rutas autenticadas.
 * Verifica la existencia y firma del Bearer token en el header Authorization.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError(
        'Acceso denegado. No se proporcionó un token de autorización.',
        401,
        'ERR_AUTH_TOKEN_MISSING'
      );
    }

    // Verificar formato 'Bearer <token>'
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AppError(
        'El formato del token de autorización no es válido. Utilice Bearer [token].',
        401,
        'ERR_AUTH_INVALID_TOKEN'
      );
    }

    const token = parts[1];

    try {
      // Verificar firma del token JWT utilizando la llave pública (algoritmo RS256)
      const decodedPayload = verifyAccessToken(token);

      // Adjuntar el payload decodificado directamente al contexto de la solicitud
      req.user = decodedPayload;

      next();
    } catch (jwtError: any) {
      // Manejar de forma explícita los errores generados por la librería jsonwebtoken
      if (jwtError.name === 'TokenExpiredError') {
        throw new AppError(
          'Su sesión ha expirado. Por favor, vuelva a iniciar sesión.',
          401,
          'ERR_AUTH_TOKEN_EXPIRED'
        );
      }
      
      throw new AppError(
        'El token provisto es inválido o ha sido alterado.',
        401,
        'ERR_AUTH_INVALID_TOKEN'
      );
    }
  } catch (error) {
    next(error);
  }
}
