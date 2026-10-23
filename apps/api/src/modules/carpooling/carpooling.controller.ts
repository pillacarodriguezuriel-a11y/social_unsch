import { Request, Response, NextFunction } from 'express';
import { CarpoolingService } from './carpooling.service';

/**
 * Función auxiliar para sanitizar strings contra ataques XSS.
 * Convierte caracteres especiales de HTML a sus equivalentes seguros.
 */
function escapeXSS(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      default: return match;
    }
  });
}

export class CarpoolingController {
  private carpoolingService = new CarpoolingService();

  /**
   * GET /api/v1/carpooling
   * Recupera las rutas activas aplicando filtros y sanitización XSS.
   */
  getRoutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const originDistrictQuery = req.query.origin_district 
        ? escapeXSS(String(req.query.origin_district)) 
        : undefined;

      const routes = await this.carpoolingService.getActiveRoutes(originDistrictQuery);
      
      res.status(200).json({
        data: routes,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/carpooling/:route_id/request
   * Registra una solicitud de reserva para un asiento.
   */
  requestSeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const routeId = escapeXSS(req.params.route_id);
      const passengerId = req.user?.user_id;

      if (!passengerId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto de seguridad.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      const requestDetails = await this.carpoolingService.requestSeat(routeId, passengerId);

      res.status(201).json({
        success: true,
        message: 'Solicitud de asiento registrada exitosamente.',
        data: requestDetails,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/carpooling/:route_id/confirm
   * Aprueba la reserva desvelando los datos de contacto a ambas partes.
   */
  confirmSeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const routeId = escapeXSS(req.params.route_id);
      const driverId = req.user?.user_id;
      const passengerId = req.body.passenger_id ? escapeXSS(String(req.body.passenger_id)) : undefined;

      if (!driverId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto de seguridad.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      if (!passengerId) {
        res.status(400).json({
          error: true,
          message: 'Falta especificar el identificador del pasajero (passenger_id) en el cuerpo.',
          code: 'ERR_VALIDATION_MISSING_FIELDS',
        });
        return;
      }

      const connectionDetails = await this.carpoolingService.confirmSeat(routeId, driverId, passengerId);

      res.status(200).json({
        success: true,
        message: 'Solicitud de asiento confirmada exitosamente. Se ha establecido la conexión.',
        data: connectionDetails,
      });
    } catch (error) {
      next(error);
    }
  };
}
