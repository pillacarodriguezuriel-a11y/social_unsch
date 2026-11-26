import { Request, Response, NextFunction } from 'express';
import type { FeedHttpHandlers } from '@social-unsch/feed-domain';

/**
 * Adaptador Express del servicio Feed independiente.
 *
 * Comparte validación, códigos de error y cuerpos con el modo local de
 * `apps/api` a través de `FeedHttpHandlers`. La única diferencia es que aquí el
 * identificador del usuario lo publica el guardia RS256 de este servicio.
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
        userId: req.user?.userId,
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };
}
