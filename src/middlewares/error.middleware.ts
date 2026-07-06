import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { ZodError } from 'zod';

/**
 * Middleware centralizado de manejo de errores.
 * Captura excepciones controladas (AppError), errores de validación (ZodError) y fallos del servidor.
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Manejo de errores de negocio y seguridad controlados (AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
      code: err.errorCode,
    });
    return;
  }

  // Manejo de errores de validación de esquemas (ZodError)
  if (err instanceof ZodError) {
    // Tomamos el primer error de validación para construir un mensaje claro en español
    const firstIssue = err.issues[0];
    const message = firstIssue 
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}` 
      : 'Error de validación en los datos provistos.';
      
    res.status(400).json({
      error: true,
      message: message,
      code: 'ERR_VALIDATION_INVALID_FIELDS',
    });
    return;
  }

  // Registramos detalladamente los errores inesperados para diagnóstico
  console.error('Error no controlado en el servidor:', err);

  // Respuesta por defecto ante errores internos no controlados
  res.status(500).json({
    error: true,
    message: 'Ha ocurrido un error interno en el servidor. Inténtelo más tarde.',
    code: 'ERR_SERVER_INTERNAL_ERROR',
  });
}
