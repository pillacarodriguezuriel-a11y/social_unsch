import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import feedRoutes from './modules/feed/feed.routes';
import matchmakingRoutes from './modules/matchmaking/matchmaking.routes';
import carpoolingRoutes from './modules/carpooling/carpooling.routes';
import catalogsRoutes from './modules/catalogs/catalogs.routes';
import { RadarModule } from './modules/radar/radar.module';
import { createHealthRouter, DependencyCheck } from './health/health.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { resolveAllowedOrigins } from './config/env';

/** Prefijo bajo el que se monta el radar, sea local o proxy. El frontend no cambia. */
export const RADAR_MOUNT_PATH = '/api/v1/radar';

export interface AppDependencies {
  /** Unidad de radar a montar (local por defecto; proxy previsto para la etapa 4). */
  radar: RadarModule;
  /** Comprobaciones para GET /health/ready. */
  readinessChecks: DependencyCheck[];
  /** Orígenes CORS permitidos. Si se omite, se calculan desde el entorno como antes. */
  allowedOrigins?: string[];
}

/**
 * Construye la aplicación Express sin abrir conexiones ni escuchar puertos.
 * El arranque del proceso (configuración, conexiones, puerto y apagado) está en bootstrap.ts.
 */
export function createApp(deps: AppDependencies): Application {
  const app: Application = express();
  const allowedOrigins = deps.allowedOrigins ?? resolveAllowedOrigins(process.env);

  // Middleware de seguridad Helmet
  app.use(helmet());

  // Salud: fuera de /api/v1 y antes de CORS (la consulta la plataforma, no el navegador)
  app.use('/health', createHealthRouter(deps.readinessChecks));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir peticiones sin cabecera de origen (como clientes REST, cURL, etc.)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Bloqueado por la política de CORS de la aplicación.'));
      },
      credentials: true,
    })
  );

  // Habilitar el análisis de cuerpos JSON y formularios URL-encoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  // Punto de montaje reemplazable del radar (ADR-007)
  app.use(RADAR_MOUNT_PATH, deps.radar.router);
  app.use('/api/v1/feed', feedRoutes);
  app.use('/api/v1/matchmaking', matchmakingRoutes);
  app.use('/api/v1/carpooling', carpoolingRoutes);
  app.use('/api/v1/catalogs', catalogsRoutes);

  // Middleware centralizado de manejo de errores (debe registrarse al final)
  app.use(errorMiddleware);

  return app;
}
