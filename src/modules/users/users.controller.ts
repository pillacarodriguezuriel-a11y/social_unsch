import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

export class UsersController {
  private usersService = new UsersService();

  /**
   * Controlador para actualizar el estado de aceptación de términos del usuario autenticado.
   */
  acceptTerms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // El userId se extrae de forma segura del token JWT verificado en req.user
      const userId = req.user?.user_id;

      if (!userId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      await this.usersService.acceptTerms(userId);

      res.status(200).json({
        success: true,
        message: 'Políticas y condiciones aceptadas correctamente.',
      });
    } catch (error) {
      next(error);
    }
  };
}
