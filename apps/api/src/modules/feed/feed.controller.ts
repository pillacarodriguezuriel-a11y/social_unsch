import { Request, Response, NextFunction } from 'express';
import type { FeedHttpHandlers } from '@social-unsch/feed-domain';

/**
 * Adaptador Express del dominio Feed en modo local.
 *
 * La validación, los códigos de error y los cuerpos los decide
 * `FeedHttpHandlers` en `@social-unsch/feed-domain`, compartido con
 * `apps/feed`. Aquí solo se traduce entre Express y el dominio; la única
 * diferencia con el servicio independiente es de dónde sale el identificador
 * del usuario, porque cada proceso verifica el token con su propio middleware.
 */
export class FeedController {
  constructor(private readonly handlers: FeedHttpHandlers) {}

  getFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.handlers.getFeed(req.query as Record<string, unknown>);
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };

  createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.handlers.createPost({
        body: req.body,
        userId: req.user?.user_id,
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };
}
