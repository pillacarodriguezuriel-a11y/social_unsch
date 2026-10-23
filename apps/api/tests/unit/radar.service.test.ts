/**
 * Unit Test Suite: RadarService
 *
 * Mocks: ioredis (redis client)
 * Covers:
 *   - getStatus(): happy path, pipeline vacío
 *   - submitReport(): nodo inválido, comedor estados válidos e inválidos,
 *     rectorado estados válidos e inválidos, biblioteca_floor_1..4 valores válidos/inválidos,
 *     campus_alert estados válidos e inválidos, ya votado (votesCount = -1)
 */

import { RadarRepository } from '../../src/modules/radar/radar.repository';
import { RadarService } from '../../src/modules/radar/radar.service';
import { AppError } from '../../src/shared/errors/AppError';

// Cliente Redis falso inyectado en el repositorio (composición explícita)
const redis = { pipeline: jest.fn(), eval: jest.fn() };

const mockPipeline = redis.pipeline as jest.Mock;
const mockEval = redis.eval as jest.Mock;

// ─── Helper: build a mock pipeline with n hgetall results ─────────────────────

const buildPipeline = (results: Array<[null, Record<string, string> | null]>) => {
  const pipeline = {
    hgetall: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(results),
  };
  return pipeline;
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RadarService', () => {
  let service: RadarService;

  beforeEach(() => {
    service = new RadarService(new RadarRepository(redis as any));
  });

  // ════════════════════════════════════════════════════════════════════
  // getStatus()
  // ════════════════════════════════════════════════════════════════════

  describe('getStatus()', () => {
    it('should return radar status with all nodes when Redis has data', async () => {
      const pipeline = buildPipeline([
        [null, { status: 'fluid', report_count: '5', last_updated: '1234567890' }],
        [null, { status: 'empty_window', report_count: '3', last_updated: '1234567890' }],
        [null, { occupancy: '60', report_count: '4', last_updated: '1234567890' }],
        [null, { occupancy: '40', report_count: '2', last_updated: '1234567890' }],
        [null, { occupancy: '80', report_count: '6', last_updated: '1234567890' }],
        [null, { occupancy: '20', report_count: '1', last_updated: '1234567890' }],
        [null, { status: 'class_suspended', report_count: '3', last_updated: '1234567890' }],
      ]);
      mockPipeline.mockReturnValueOnce(pipeline);

      const result = await service.getStatus();
      expect(result.comedor.status).toBe('fluid');
      expect(result.comedor.is_definite).toBe(true);
      expect(result.rectorado.status).toBe('empty_window');
      expect(result.biblioteca.floor_1.occupancy).toBe(60);
      expect(result.biblioteca.floor_2.occupancy).toBe(40);
      expect(result.biblioteca.floor_3.occupancy).toBe(80);
      expect(result.biblioteca.floor_4.occupancy).toBe(20);
      expect(result.campus_alert.status).toBe('class_suspended');
      expect(result.campus_alert.is_definite).toBe(true);
    });

    it('should return "indefinido" with is_definite=false for nodes with no Redis data', async () => {
      const pipeline = buildPipeline([
        [null, null], // comedor
        [null, null], // rectorado
        [null, null], // floor1
        [null, null], // floor2
        [null, null], // floor3
        [null, null], // floor4
        [null, null], // campus_alert
      ]);
      mockPipeline.mockReturnValueOnce(pipeline);

      const result = await service.getStatus();
      expect(result.comedor.status).toBe('indefinido');
      expect(result.comedor.is_definite).toBe(false);
      expect(result.rectorado.is_definite).toBe(false);
      expect(result.biblioteca.floor_1.is_definite).toBe(false);
      expect(result.campus_alert.is_definite).toBe(false);
    });

    it('should return "indefinido" for nodes with empty hash ({})', async () => {
      const pipeline = buildPipeline([
        [null, {}], // empty hash
        [null, {}],
        [null, {}],
        [null, {}],
        [null, {}],
        [null, {}],
        [null, {}],
      ]);
      mockPipeline.mockReturnValueOnce(pipeline);

      const result = await service.getStatus();
      expect(result.comedor.status).toBe('indefinido');
      expect(result.comedor.is_definite).toBe(false);
    });

    it('should call pipeline.hgetall 7 times (one per node)', async () => {
      const pipeline = buildPipeline(Array(7).fill([null, null]));
      mockPipeline.mockReturnValueOnce(pipeline);
      await service.getStatus();
      expect(pipeline.hgetall).toHaveBeenCalledTimes(7);
    });

    it('should throw when pipeline.exec returns null', async () => {
      const pipeline = { hgetall: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) };
      mockPipeline.mockReturnValueOnce(pipeline);
      await expect(service.getStatus()).rejects.toThrow('Error al ejecutar pipeline de Redis');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitReport() — node validation
  // ════════════════════════════════════════════════════════════════════

  describe('submitReport() — invalid node', () => {
    it('should throw AppError 400 ERR_RADAR_INVALID_NODE for unknown node', async () => {
      await expect(service.submitReport('cafeteria', 'fluid', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_NODE',
        message: 'El nodo del radar especificado no es válido.',
      });
    });

    it('should throw ERR_RADAR_INVALID_NODE for empty node string', async () => {
      await expect(service.submitReport('', 'fluid', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_NODE',
      });
    });

    it('should throw ERR_RADAR_INVALID_NODE for a partially correct node name', async () => {
      await expect(service.submitReport('biblioteca', '50', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_NODE',
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitReport() — comedor
  // ════════════════════════════════════════════════════════════════════

  describe('submitReport() — comedor node', () => {
    const userId = 'user-comedor-uuid';

    it('should accept valid comedor status "fluid"', async () => {
      mockEval.mockResolvedValueOnce([1, 3, 'Estado actualizado']);
      const result = await service.submitReport('comedor', 'fluid', userId);
      expect(result.updated).toBe(true);
    });

    it('should accept valid comedor status "medium_queue"', async () => {
      mockEval.mockResolvedValueOnce([0, 2, 'Reporte registrado']);
      const result = await service.submitReport('comedor', 'medium_queue', userId);
      expect(result.updated).toBe(false);
    });

    it('should accept valid comedor status "long_queue"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'long_queue', userId)).resolves.toBeDefined();
    });

    it('should accept valid comedor status "closed"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'closed', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish comedor status "Fluido"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'Fluido', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish comedor status "Cola Media"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'Cola Media', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish comedor status "Cola Larga"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'Cola Larga', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish comedor status "Cerrado"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('comedor', 'Cerrado', userId)).resolves.toBeDefined();
    });

    it('should throw ERR_RADAR_INVALID_STATUS for invalid comedor status "super_full"', async () => {
      await expect(service.submitReport('comedor', 'super_full', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
        message: 'El estado reportado para el comedor no es válido.',
      });
    });

    it('should return updated=false and votesCount=0 when user already voted (votesCount=-1)', async () => {
      mockEval.mockResolvedValueOnce([0, -1, 'Ya reportaste este estado en la ventana actual']);
      const result = await service.submitReport('comedor', 'fluid', userId);
      expect(result.updated).toBe(false);
      expect(result.votesCount).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitReport() — rectorado
  // ════════════════════════════════════════════════════════════════════

  describe('submitReport() — rectorado node', () => {
    const userId = 'user-rectorado-uuid';

    it('should accept valid rectorado status "empty_window"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('rectorado', 'empty_window', userId)).resolves.toBeDefined();
    });

    it('should accept valid rectorado status "waiting_15"', async () => {
      mockEval.mockResolvedValueOnce([0, 2, 'Reporte registrado']);
      await expect(service.submitReport('rectorado', 'waiting_15', userId)).resolves.toBeDefined();
    });

    it('should accept valid rectorado status "collapsed"', async () => {
      mockEval.mockResolvedValueOnce([1, 3, 'Estado actualizado']);
      await expect(service.submitReport('rectorado', 'collapsed', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish rectorado status "Ventanilla vacía"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('rectorado', 'Ventanilla vacía', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish rectorado status "Espera de 15 min"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('rectorado', 'Espera de 15 min', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish rectorado status "Colapsado"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('rectorado', 'Colapsado', userId)).resolves.toBeDefined();
    });

    it('should throw ERR_RADAR_INVALID_STATUS for invalid rectorado status', async () => {
      await expect(service.submitReport('rectorado', 'open', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
        message: 'El estado reportado para el rectorado no es válido.',
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitReport() — biblioteca floors
  // ════════════════════════════════════════════════════════════════════

  describe('submitReport() — biblioteca floors', () => {
    const userId = 'user-biblioteca-uuid';

    it.each(['biblioteca_floor_1', 'biblioteca_floor_2', 'biblioteca_floor_3', 'biblioteca_floor_4'])(
      'should accept valid occupancy "50" for %s',
      async (node) => {
        mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
        await expect(service.submitReport(node, '50', userId)).resolves.toBeDefined();
      }
    );

    it('should accept occupancy "0" as valid boundary', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('biblioteca_floor_1', '0', userId)).resolves.toBeDefined();
    });

    it('should accept occupancy "100" as valid boundary', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('biblioteca_floor_1', '100', userId)).resolves.toBeDefined();
    });

    it('should throw ERR_RADAR_INVALID_STATUS when occupancy is NaN', async () => {
      await expect(service.submitReport('biblioteca_floor_1', 'alta', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
        message: 'El aforo de la biblioteca debe ser un porcentaje entero entre 0 y 100.',
      });
    });

    it('should throw ERR_RADAR_INVALID_STATUS when occupancy is negative (-1)', async () => {
      await expect(service.submitReport('biblioteca_floor_2', '-1', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
      });
    });

    it('should throw ERR_RADAR_INVALID_STATUS when occupancy > 100', async () => {
      await expect(service.submitReport('biblioteca_floor_3', '101', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
      });
    });

    it('should use fieldName "occupancy" for biblioteca nodes', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await service.submitReport('biblioteca_floor_1', '75', userId);
      const evalArgs = (mockEval as jest.Mock).mock.calls[0];
      expect(evalArgs).toContain('occupancy');
    });

    it('should use the correct hashKey format for biblioteca floor 2', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await service.submitReport('biblioteca_floor_2', '30', userId);
      const evalArgs = (mockEval as jest.Mock).mock.calls[0];
      expect(evalArgs).toContain('radar:biblioteca:floor:2:occupancy');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // submitReport() — campus_alert
  // ════════════════════════════════════════════════════════════════════

  describe('submitReport() — campus_alert node', () => {
    const userId = 'user-alert-uuid';

    it('should accept valid alert status "class_suspended"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'class_suspended', userId)).resolves.toBeDefined();
    });

    it('should accept valid alert status "cultural_event"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'cultural_event', userId)).resolves.toBeDefined();
    });

    it('should accept valid alert status "lost_item_dni"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'lost_item_dni', userId)).resolves.toBeDefined();
    });

    it('should accept valid alert status "lost_item_keys"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'lost_item_keys', userId)).resolves.toBeDefined();
    });

    it('should accept valid alert status "lost_item_other"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'lost_item_other', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish alert status "Clase suspendida"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'Clase suspendida', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish alert status "Evento cultural"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'Evento cultural', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish alert status "Pérdida de DNI"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'Pérdida de DNI', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish alert status "Pérdida de Llaves"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'Pérdida de Llaves', userId)).resolves.toBeDefined();
    });

    it('should accept Spanish alert status "Pérdida de objeto"', async () => {
      mockEval.mockResolvedValueOnce([0, 1, 'Reporte registrado']);
      await expect(service.submitReport('campus_alert', 'Pérdida de objeto', userId)).resolves.toBeDefined();
    });

    it('should throw ERR_RADAR_INVALID_STATUS for invalid campus_alert status', async () => {
      await expect(service.submitReport('campus_alert', 'earthquake_alert', userId)).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'ERR_RADAR_INVALID_STATUS',
        message: 'El estado reportado para la alerta de campus no es válido.',
      });
    });

    it('should return updated=true when eval returns [1, count, message]', async () => {
      mockEval.mockResolvedValueOnce([1, 3, 'Estado actualizado']);
      const result = await service.submitReport('campus_alert', 'class_suspended', userId);
      expect(result.updated).toBe(true);
      expect(result.votesCount).toBe(3);
    });

    it('should return updated=false when eval returns [0, count, message]', async () => {
      mockEval.mockResolvedValueOnce([0, 2, 'Reporte registrado, esperando']);
      const result = await service.submitReport('campus_alert', 'class_suspended', userId);
      expect(result.updated).toBe(false);
      expect(result.votesCount).toBe(2);
    });
  });
});
