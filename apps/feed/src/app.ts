import express, { Application, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { createLoggingMiddleware } from './middlewares/logging.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { createFeedHealthRouter } from './health/health.routes';
import { createFeedModule } from './modules/feed/feed.module';

export interface FeedAppDependencies {
  pool: Pool;
  authGuard: RequestHandler;
  allowedOrigins?: string[];
  serviceName?: string;
}

/**
 * Fábrica de la aplicación Express del servicio Feed.
 * No abre conexiones ni escucha puertos; eso es responsabilidad de server.ts.
 */
export function createFeedApp({
  pool,
  authGuard,
  allowedOrigins,
  serviceName = 'social-unsch-feed',
}: FeedAppDependencies): Application {
  const app = express();

  app.use(helmet());

  if (allowedOrigins && allowedOrigins.length > 0) {
    app.use(cors({ origin: allowedOrigins, credentials: true }));
  } else {
    app.use(cors());
  }

  app.use(express.json());
  app.use(createLoggingMiddleware(serviceName));

  // Salud: liveness y readiness (comprueba PostgreSQL)
  app.use('/health', createFeedHealthRouter({ pool }));

  // Rutas del dominio Feed
  const feedRouter = createFeedModule({ pool, authGuard });
  app.use('/api/v1/feed', feedRouter);
  app.use('/', feedRouter);

  // 404
  app.use((_req, res) => {
    res.locals.errorCode = 'ERR_NOT_FOUND';
    res.status(404).json({
      error: true,
      message: 'Ruta no encontrada en el servicio Feed.',
      code: 'ERR_NOT_FOUND',
    });
  });

  app.use(errorMiddleware);

  return app;
}
