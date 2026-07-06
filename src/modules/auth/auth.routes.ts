import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const authController = new AuthController();

// Ruta pública para registrar un nuevo usuario
router.post('/register', authController.register);

// Ruta pública para iniciar sesión
router.post('/login', authController.login);

// Ruta protegida de prueba para validar el correcto funcionamiento del AuthGuard (requireAuth)
router.get('/profile-me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token de acceso válido. Perfil recuperado del contexto de forma segura.',
    user: req.user,
  });
});

export default router;
