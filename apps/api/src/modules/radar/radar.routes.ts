import { RequestHandler, Router } from 'express';
import { RadarController } from './radar.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

/**
 * Rutas locales del Campus Radar. Ambas exigen autenticación (requireAuth).
 * Se montan en /api/v1/radar desde la composición de la aplicación (ver radar.module.ts).
 */
export function createRadarRouter(
  controller: RadarController,
  authGuard: RequestHandler = requireAuth
): Router {
  const router = Router();
  router.get('/status', authGuard, controller.getStatus);
  router.post('/report', authGuard, controller.submitReport);
  return router;
}
