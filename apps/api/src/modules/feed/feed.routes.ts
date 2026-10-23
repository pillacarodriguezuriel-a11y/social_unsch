import { Router } from 'express';
import { FeedController } from './feed.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const feedController = new FeedController();

// Ambas rutas del feed requieren autenticación obligatoria (requireAuth)
router.get('/', requireAuth, feedController.getFeed);
router.post('/', requireAuth, feedController.createPost);

export default router;
