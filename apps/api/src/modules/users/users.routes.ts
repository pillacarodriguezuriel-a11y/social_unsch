import { Router } from 'express';
import { UsersController } from './users.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const usersController = new UsersController();

// Ruta protegida para aceptar los términos y condiciones de la plataforma
router.patch('/accept-terms', requireAuth, usersController.acceptTerms);

export default router;
