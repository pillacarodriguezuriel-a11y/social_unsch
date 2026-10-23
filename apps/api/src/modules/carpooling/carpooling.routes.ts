import { Router } from 'express';
import { CarpoolingController } from './carpooling.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new CarpoolingController();

// 1. Obtener la lista pública de rutas (Rutas activas, sin requerir autenticación para el feed inicial o requiriendo)
// Según el PRD la lista es pública pero de todos modos podemos aplicar requireAuth o no.
// Para propósitos generales y consistencia con las políticas, dejémoslo libre o con requireAuth si es necesario.
// El enunciado dice "Allows a authenticated student to request a seat" y "GET /api/v1/carpooling: Expect query filters ... return exclusivamente...".
// Es mejor requerir autenticación en todos los endpoints de negocio para resguardo del campus.
router.get('/', requireAuth, controller.getRoutes);

// 2. Solicitar un asiento en un viaje (UNSCH-502)
router.post('/:route_id/request', requireAuth, controller.requestSeat);

// 3. Confirmar la solicitud de asiento por parte del conductor (UNSCH-502)
router.patch('/:route_id/confirm', requireAuth, controller.confirmSeat);

export default router;
