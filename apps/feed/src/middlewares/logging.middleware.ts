import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware de observabilidad para el servicio Feed.
 * - Valida x-request-id (alfanumérico, ≤64 chars); genera UUID v4 si falta o es inválido.
 * - Propaga x-request-id en la respuesta.
 * - Registra duración, método, ruta, código HTTP y código de error si existe.
 * - NUNCA registra cabeceras Authorization, cookies ni datos sensibles.
 */
export function createLoggingMiddleware(serviceName = 'social-unsch-feed') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawId = req.headers['x-request-id'];
    let requestId: string;

    if (typeof rawId === 'string' && /^[a-zA-Z0-9_\-\.]{1,64}$/.test(rawId.trim())) {
      requestId = rawId.trim();
    } else {
      requestId = crypto.randomUUID();
    }

    res.setHeader('x-request-id', requestId);
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
      const logEntry = {
        timestamp: new Date().toISOString(),
        service: serviceName,
        requestId,
        method: req.method,
        path: req.baseUrl + (req.path === '/' ? '' : req.path),
        statusCode: res.statusCode,
        durationMs,
        errorCode: res.locals.errorCode || undefined,
      };

      if (res.statusCode >= 500) {
        console.error(JSON.stringify(logEntry));
      } else if (res.statusCode >= 400) {
        console.warn(JSON.stringify(logEntry));
      } else {
        console.log(JSON.stringify(logEntry));
      }
    });

    next();
  };
}
