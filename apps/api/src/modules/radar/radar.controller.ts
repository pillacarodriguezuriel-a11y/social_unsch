import { Request, Response, NextFunction } from 'express';
import { RadarService } from './radar.service';

export class RadarController {
  private radarService = new RadarService();

  /**
   * Obtiene el estado consolidado de afluencia de todos los nodos del Campus Radar.
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.radarService.getStatus();
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Envía un reporte de tráfico para un nodo específico.
   * Exige autenticación de usuario.
   */
  submitReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { node, status } = req.body;
      const userId = req.user?.user_id;

      if (!userId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      if (!node || !status) {
        res.status(400).json({
          error: true,
          message: 'Faltan parámetros requeridos: node y status.',
          code: 'ERR_VALIDATION_INVALID_FIELDS',
        });
        return;
      }

      const result = await this.radarService.submitReport(node, status, userId);

      if (result.updated) {
        res.status(200).json({
          message: `Reporte registrado. Estado actualizado a: ${status}.`,
          updated: true,
          current_status: status,
        });
      } else {
        res.status(200).json({
          message: 'Reporte registrado. Se necesitan más confirmaciones para actualizar el estado.',
          updated: false,
          votes_current: result.votesCount,
          votes_required: 3,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}
