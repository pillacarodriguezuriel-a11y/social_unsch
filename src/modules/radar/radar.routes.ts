import { Router } from 'express';
import { RadarController } from './radar.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const radarController = new RadarController();

// Ambos endpoints del Campus Radar requieren autenticación obligatoria (requireAuth)
router.get('/status', requireAuth, radarController.getStatus);
router.post('/report', requireAuth, radarController.submitReport);

export default router;
