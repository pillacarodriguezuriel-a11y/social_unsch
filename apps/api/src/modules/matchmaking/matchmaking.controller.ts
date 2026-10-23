import { Request, Response, NextFunction } from 'express';
import { MatchmakingService } from './matchmaking.service';
import { z } from 'zod';

export class MatchmakingController {
  private matchmakingService = new MatchmakingService();

  // Esquina de validación de Zod
  private scoreSchema = z.object({
    project_id: z.string().uuid({ message: 'El project_id debe ser un UUID válido.' }),
    user_skills: z.array(z.string().min(1)).min(1, { message: 'El arreglo de habilidades no debe estar vacío.' }),
  });

  private interactSchema = z.object({
    receiver_profile_id: z.string().uuid({ message: 'El receiver_profile_id debe ser un UUID válido.' }),
    action: z.enum(['like', 'dislike'], { message: 'La acción de interacción debe ser "like" o "dislike".' }),
  });

  /**
   * Endpoint de puntuación de afinidad algorítmica.
   */
  calculateScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = this.scoreSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: true,
          message: parsed.error.issues[0].message,
          code: 'ERR_VALIDATION_INVALID_FIELDS',
        });
        return;
      }

      const result = await this.matchmakingService.calculateScore(
        parsed.data.project_id,
        parsed.data.user_skills
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Recupera los perfiles descubribles anonimizados (Ley N° 29733).
   */
  getDiscoverableProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      const profiles = await this.matchmakingService.getDiscoverableProfiles(userId);
      res.status(200).json({
        data: profiles,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Registra una interacción en la máquina de estados de emparejamiento.
   */
  submitInteraction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      const parsed = this.interactSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: true,
          message: parsed.error.issues[0].message,
          code: 'ERR_VALIDATION_INVALID_FIELDS',
        });
        return;
      }

      const result = await this.matchmakingService.submitInteraction(
        userId,
        parsed.data.receiver_profile_id,
        parsed.data.action
      );

      if (result.status === 'accepted') {
        res.status(200).json({
          message: '¡Conexión Sancristobalina exitosa! Doble match confirmado.',
          match: true,
          status: 'accepted',
          chat_channel_id: result.chatChannelId,
          contact_info: result.contactInfo,
        });
      } else {
        res.status(200).json({
          message: parsed.data.action === 'like' 
            ? 'Solicitud de conexión enviada. Esperando confirmación del receptor.'
            : 'Perfil descartado de la cola de emparejamiento.',
          match: false,
          status: result.status,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}
