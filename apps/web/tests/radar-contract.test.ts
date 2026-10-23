/**
 * Compatibilidad del frontend con el contrato de Radar.
 *
 * Los botones del radar envían valores definidos en el frontend. Si alguno no está en el contrato,
 * la API respondería 400. Las pruebas pueden importar valores del contrato; el código de la
 * aplicación solo importa tipos (ver scripts/check-boundaries.js).
 */
import {
  RADAR_CAMPUS_ALERT_STATUSES,
  RADAR_COMEDOR_STATUSES,
  RADAR_LIBRARY_OCCUPANCY_MAX,
  RADAR_LIBRARY_OCCUPANCY_MIN,
  RADAR_NODES,
  RADAR_RECTORADO_STATUSES,
  RadarReportRequestSchema,
} from '@social-unsch/contracts';
import { CAMPUS_ALERT_TYPES, COMEDOR_STATUSES, RECTORADO_STATUSES } from '../app/lib/unsch.constants';

const values = (list: ReadonlyArray<{ value: string }>) => list.map((x) => x.value);

describe('valores del radar enviados por el frontend', () => {
  it('los estados del comedor existen en el contrato', () => {
    expect(RADAR_COMEDOR_STATUSES).toEqual(expect.arrayContaining(values(COMEDOR_STATUSES)));
  });

  it('los estados del rectorado existen en el contrato', () => {
    expect(RADAR_RECTORADO_STATUSES).toEqual(expect.arrayContaining(values(RECTORADO_STATUSES)));
  });

  it('las alertas de campus existen en el contrato', () => {
    expect(RADAR_CAMPUS_ALERT_STATUSES).toEqual(expect.arrayContaining(values(CAMPUS_ALERT_TYPES)));
  });

  it('los nodos y aforos que usa CampusRadar forman solicitudes válidas', () => {
    const nodes = ['comedor', 'rectorado', 'campus_alert', 'biblioteca_floor_1', 'biblioteca_floor_2', 'biblioteca_floor_3', 'biblioteca_floor_4'];
    expect([...RADAR_NODES].sort()).toEqual([...nodes].sort());
    for (const pct of ['25', '50', '80']) {
      const n = Number(pct);
      expect(n).toBeGreaterThanOrEqual(RADAR_LIBRARY_OCCUPANCY_MIN);
      expect(n).toBeLessThanOrEqual(RADAR_LIBRARY_OCCUPANCY_MAX);
      expect(RadarReportRequestSchema.safeParse({ node: 'biblioteca_floor_1', status: pct }).success).toBe(true);
    }
  });
});
