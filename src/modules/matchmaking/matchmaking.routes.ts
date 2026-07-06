import { Router } from 'express';
import { MatchmakingController } from './matchmaking.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const matchmakingController = new MatchmakingController();

// Todos los endpoints de Matchmaking exigen autenticación por token (requireAuth)
router.post('/score', requireAuth, matchmakingController.calculateScore);
router.get('/profiles', requireAuth, matchmakingController.getDiscoverableProfiles);
router.post('/interact', requireAuth, matchmakingController.submitInteraction);

export default router;
