import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.validators';

export class AuthController {
  private authService = new AuthService();

  /**
   * Controlador para registrar un nuevo usuario.
   * Valida la estructura del body con Zod y llama al servicio correspondiente.
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validar inputs obligatoriamente a nivel de backend
      const validatedData = registerSchema.parse(req.body);

      // Llamar al servicio de negocio
      const result = await this.authService.register({
        full_name: validatedData.full_name,
        email: validatedData.email,
        password_hash: validatedData.password, // Pasado temporalmente como password_hash para que el servicio lo cifre
        role: validatedData.role,
        professional_school_id: validatedData.professional_school_id,
        current_academic_cycle: validatedData.current_academic_cycle,
      });

      // Retornar respuesta estándar de creación 201
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Controlador para iniciar sesión.
   * Valida los datos y genera el token de acceso.
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validar inputs
      const validatedData = loginSchema.parse(req.body);

      // Iniciar sesión y obtener token + datos de usuario
      const result = await this.authService.login(validatedData.email, validatedData.password);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
