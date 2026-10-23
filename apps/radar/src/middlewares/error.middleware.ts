import { Request, Response, NextFunction } from 'express';

export class RadarAppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RadarAppError';
  }
}

/**
 * Middleware centralizado de errores para Radar.
 * Garantiza respuestas JSON con el formato canónico ErrorResponseSchema.
 */
export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const code = typeof err.code === 'string' ? err.code : 'ERR_SERVER_INTERNAL_ERROR';
  const message = err.message || 'Error no controlado en el servicio Radar.';

  if (!res.locals) res.locals = {};
  res.locals.errorCode = code;

  // Registrar detalles para diagnóstico sin volcar información sensible
  if (statusCode >= 500) {
    console.error(`[Radar-Error]: ${code} (${statusCode}) - ${message}`, err.stack);
  }

  res.status(statusCode).json({
    error: true,
    message: statusCode >= 500 ? 'Error interno del servidor. Por favor, intente más tarde.' : message,
    code,
  });
}
