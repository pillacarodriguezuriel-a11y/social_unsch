import {
  RADAR_CAMPUS_ALERT_STATUSES,
  RADAR_COMEDOR_STATUSES,
  RADAR_LIBRARY_OCCUPANCY_MAX,
  RADAR_LIBRARY_OCCUPANCY_MIN,
  RADAR_NODES,
  RADAR_RECTORADO_STATUSES,
} from '@social-unsch/contracts';
import { RadarStatusResponse, RadarStore, RadarVoteResult } from './radar.repository';
import { RadarAppError } from '../../middlewares/error.middleware';

export class RadarService {
  private readonly allowedNodes: readonly string[] = RADAR_NODES;
  private readonly allowedComedorStatuses: readonly string[] = RADAR_COMEDOR_STATUSES;
  private readonly allowedRectoradoStatuses: readonly string[] = RADAR_RECTORADO_STATUSES;
  private readonly allowedAlertStatuses: readonly string[] = RADAR_CAMPUS_ALERT_STATUSES;

  constructor(private readonly radarRepository: RadarStore) {}

  /**
   * Obtiene el estado consolidado de afluencia del campus.
   */
  async getStatus(): Promise<RadarStatusResponse> {
    return this.radarRepository.getStatus();
  }

  /**
   * Registra un reporte de tráfico validando nodos y estados canónicos/bilingües.
   */
  async submitReport(
    node: string,
    status: string,
    userId: string
  ): Promise<RadarVoteResult> {
    // 1. Validar existencia del nodo
    if (!this.allowedNodes.includes(node as any)) {
      throw new RadarAppError(
        'El nodo del radar especificado no es válido.',
        400,
        'ERR_RADAR_INVALID_NODE'
      );
    }

    let fieldName: 'status' | 'occupancy' = 'status';
    let allPossibleSets: string[] = [];

    // 2. Validar valor del estado según el tipo de nodo (preservando bilingüismo)
    if (node === 'comedor') {
      if (!this.allowedComedorStatuses.includes(status as any)) {
        throw new RadarAppError(
          'El estado reportado para el comedor no es válido.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'status';
      allPossibleSets = this.allowedComedorStatuses.map(
        (s) => `radar:comedor:reports:${s.replace(/\s+/g, '_')}`
      );
    } else if (node === 'rectorado') {
      if (!this.allowedRectoradoStatuses.includes(status as any)) {
        throw new RadarAppError(
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
      if (
        isNaN(occupancyVal) ||
        occupancyVal < RADAR_LIBRARY_OCCUPANCY_MIN ||
        occupancyVal > RADAR_LIBRARY_OCCUPANCY_MAX
      ) {
        throw new RadarAppError(
          'El aforo de la biblioteca debe ser un porcentaje entero entre 0 y 100.',
          400,
          'ERR_RADAR_INVALID_STATUS'
        );
      }
      fieldName = 'occupancy';
      const commonValues = ['0', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '90', '100', status];
      allPossibleSets = Array.from(new Set(commonValues)).map(
        (val) => `radar:${node}:reports:${val}`
      );
    } else if (node === 'campus_alert') {
      if (!this.allowedAlertStatuses.includes(status as any)) {
        throw new RadarAppError(
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

    // 3. Registrar el voto en el almacén de forma atómica
    return this.radarRepository.submitReport(
      node,
      status,
      userId,
      fieldName,
      allPossibleSets
    );
  }
}
