import { RequestHandler, Router } from 'express';
import { RadarController } from './radar.controller';

/**
 * Crea las rutas protegidas del servicio Radar (/status y /report).
 */
export function createRadarRouter(
  controller: RadarController,
  authGuard: RequestHandler
): Router {
  const router = Router();

  router.get('/status', authGuard, controller.getStatus);
  router.post('/report', authGuard, controller.submitReport);

  return router;
}
