import express, { Application, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type Redis from 'ioredis';
import { createLoggingMiddleware } from './middlewares/logging.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { createRadarHealthRouter } from './health/health.routes';
import { RadarRedisClient, RadarRepository } from './modules/radar/radar.repository';
import { RadarService } from './modules/radar/radar.service';
import { RadarController } from './modules/radar/radar.controller';
import { createRadarRouter } from './modules/radar/radar.routes';

export interface RadarAppDependencies {
  redis: RadarRedisClient & Pick<Redis, 'ping'>;
  authGuard: RequestHandler;
  allowedOrigins?: string[];
  serviceName?: string;
}

/**
 * Fábrica de la aplicación Express para el servicio independiente Radar.
 * Separada del arranque del servidor para facilitar pruebas unitarias y de integración.
 */
export function createRadarApp({
  redis,
  authGuard,
  allowedOrigins,
  serviceName = 'social-unsch-radar',
}: RadarAppDependencies): Application {
  const app = express();

  // Seguridad básica
  app.use(helmet());

  // CORS
  if (allowedOrigins && allowedOrigins.length > 0) {
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
      })
    );
  } else {
    app.use(cors());
  }

  // Parseo de cuerpo JSON
  app.use(express.json());

  // Trazabilidad y observabilidad estructurada
  app.use(createLoggingMiddleware(serviceName));

  // Rutas de salud (liveness y readiness)
  app.use('/health', createRadarHealthRouter({ redis }));

  // Inicialización de la capa de dominio
  const repository = new RadarRepository(redis);
  const service = new RadarService(repository);
  const controller = new RadarController(service);
  const radarRouter = createRadarRouter(controller, authGuard);

  // Montaje en la ruta canónica (/api/v1/radar) y en la raíz para máxima flexibilidad
  app.use('/api/v1/radar', radarRouter);
  app.use('/', radarRouter);

  // Manejador 404 para rutas inexistentes
  app.use((_req, res) => {
    res.locals.errorCode = 'ERR_NOT_FOUND';
    res.status(404).json({
      error: true,
      message: 'Ruta no encontrada en el servicio Radar.',
      code: 'ERR_NOT_FOUND',
    });
  });

  // Manejador centralizado de errores
  app.use(errorMiddleware);

  return app;
}
