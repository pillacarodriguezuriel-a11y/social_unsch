import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware de observabilidad y trazabilidad estructurada para Radar.
 * 
 * Reglas de seguridad y observabilidad:
 * - Valida y acota identificadores externos de solicitud (x-request-id: alfanumérico hasta 64 caracteres).
 * - Si no existe o es inválido, genera un UUID v4.
 * - Propaga x-request-id en la respuesta para correlación distribuida.
 * - Registra duración, método, ruta, código HTTP y código de error si existe.
 * - NUNCA registra cabeceras Authorization, cookies, contraseñas ni datos sensibles.
 */
export function createLoggingMiddleware(serviceName = 'social-unsch-radar') {
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
      const endTime = process.hrtime.bigint();
      const durationMs = Number((endTime - startTime) / 1000000n);

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

      // Registro estructurado
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
