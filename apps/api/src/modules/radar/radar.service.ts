import { RadarRepository, RadarStatusResponse } from './radar.repository';
import { AppError } from '../../shared/errors/AppError';

export class RadarService {
  private radarRepository = new RadarRepository();

  // Nodos permitidos del Campus Radar
  private allowedNodes = [
    'comedor',
    'rectorado',
    'biblioteca_floor_1',
    'biblioteca_floor_2',
    'biblioteca_floor_3',
    'biblioteca_floor_4',
    'campus_alert',
  ];

  // Estados permitidos para el Comedor
  private allowedComedorStatuses = [
    'fluid', 'medium_queue', 'long_queue', 'closed', // Inglés
    'Fluido', 'Cola Media', 'Cola Larga', 'Cerrado' // Español
  ];

  // Estados permitidos para el Rectorado
  private allowedRectoradoStatuses = [
    'empty_window', 'waiting_15', 'collapsed', // Inglés
    'Ventanilla vacía', 'Espera de 15 min', 'Colapsado' // Español
  ];

  // Estados permitidos para las alertas de campus
  private allowedAlertStatuses = [
    'class_suspended', 'cultural_event', 'lost_item_dni', 'lost_item_keys', 'lost_item_other',
    'Clase suspendida', 'Evento cultural', 'Pérdida de DNI', 'Pérdida de Llaves', 'Pérdida de objeto'
  ];

  /**
   * Obtiene el estado consolidado del Campus Radar.
   */
  async getStatus(): Promise<RadarStatusResponse> {
    return this.radarRepository.getStatus();
  }

  /**
   * Registra un reporte de tráfico de forma segura.
   */
  async submitReport(
    node: string,
    status: string,
    userId: string
  ): Promise<{ updated: boolean; votesCount: number; message: string }> {
    // 1. Validar existencia del nodo
    if (!this.allowedNodes.includes(node)) {
      throw new AppError(
        'El nodo del radar especificado no es válido.',
        400,
        'ERR_RADAR_INVALID_NODE'
      );
    }

    let fieldName: 'status' | 'occupancy' = 'status';
    let allPossibleSets: string[] = [];

    // 2. Validar valor del estado según el tipo de nodo
    if (node === 'comedor') {
      if (!this.allowedComedorStatuses.includes(status)) {
        throw new AppError(
          'El estado reportado para el comedor no es válido.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'status';
      // Construir todas las llaves posibles para borrar
      allPossibleSets = this.allowedComedorStatuses.map(
        (s) => `radar:comedor:reports:${s.replace(/\s+/g, '_')}`
      );
    } else if (node === 'rectorado') {
      if (!this.allowedRectoradoStatuses.includes(status)) {
        throw new AppError(
          'El estado reportado para el rectorado no es válido.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'status';
      allPossibleSets = this.allowedRectoradoStatuses.map(
        (s) => `radar:rectorado:reports:${s.replace(/\s+/g, '_')}`
      );
    } else if (node.startsWith('biblioteca_floor_')) {
      const occupancyVal = Number(status);
      if (isNaN(occupancyVal) || occupancyVal < 0 || occupancyVal > 100) {
        throw new AppError(
          'El aforo de la biblioteca debe ser un porcentaje entero entre 0 y 100.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'occupancy';
      // Generar sets para valores comunes de aforo (múltiplos de 10 y cuartos)
      const commonValues = ['0', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '90', '100', status];
      allPossibleSets = Array.from(new Set(commonValues)).map(
        (val) => `radar:${node}:reports:${val}`
      );
    } else if (node === 'campus_alert') {
      if (!this.allowedAlertStatuses.includes(status)) {
        throw new AppError(
          'El estado reportado para la alerta de campus no es válido.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'status';
      allPossibleSets = this.allowedAlertStatuses.map(
        (s) => `radar:campus_alert:reports:${s.replace(/\s+/g, '_')}`
      );
    }

    return this.radarRepository.submitReport(node, status, userId, fieldName, allPossibleSets);
  }
}
