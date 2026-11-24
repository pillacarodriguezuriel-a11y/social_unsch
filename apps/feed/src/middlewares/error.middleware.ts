import { Request, Response, NextFunction } from 'express';
import { FeedError } from '@social-unsch/feed-domain';

export function errorMiddleware(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof FeedError) {
    res.locals.errorCode = err.errorCode;
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
      code: err.errorCode,
    });
    return;
  }

  console.error('Error no controlado en Feed:', err);
  res.locals.errorCode = 'ERR_SERVER_INTERNAL_ERROR';
  res.status(500).json({
    error: true,
    message: 'Ha ocurrido un error interno en el servidor. Inténtelo más tarde.',
    code: 'ERR_SERVER_INTERNAL_ERROR',
  });
}
