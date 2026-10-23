import { RadarService } from '../../src/modules/radar/radar.service';
import { RadarStore } from '../../src/modules/radar/radar.repository';
import { RadarAppError } from '../../src/middlewares/error.middleware';

describe('apps/radar - RadarService', () => {
  let mockStore: jest.Mocked<RadarStore>;
  let service: RadarService;

  beforeEach(() => {
    mockStore = {
      getStatus: jest.fn(),
      submitReport: jest.fn(),
    };
    service = new RadarService(mockStore);
  });

  describe('getStatus', () => {
    it('delega en el repositorio para obtener el estado consolidado', async () => {
      const mockStatus: any = { comedor: { status: 'fluid', is_definite: true } };
      mockStore.getStatus.mockResolvedValue(mockStatus);

      const res = await service.getStatus();
      expect(res).toBe(mockStatus);
      expect(mockStore.getStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitReport', () => {
    it('lanza 400 ERR_RADAR_INVALID_NODE ante nodo no reconocido', async () => {
      await expect(
        service.submitReport('nodo_inexistente', 'fluid', 'user-1')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'ERR_RADAR_INVALID_NODE',
      });
      expect(mockStore.submitReport).not.toHaveBeenCalled();
    });

    describe('comedor', () => {
      it('acepta estados válidos en inglés y español', async () => {
        mockStore.submitReport.mockResolvedValue({ updated: true, votesCount: 3, message: 'ok' });

        // Inglés
        await service.submitReport('comedor', 'fluid', 'user-1');
        expect(mockStore.submitReport).toHaveBeenCalledWith(
          'comedor',
          'fluid',
          'user-1',
          'status',
          expect.any(Array)
        );

        // Español
        await service.submitReport('comedor', 'Cola Media', 'user-2');
        expect(mockStore.submitReport).toHaveBeenCalledWith(
          'comedor',
          'Cola Media',
          'user-2',
          'status',
          expect.any(Array)
        );
      });

      it('rechaza estado no permitido para comedor', async () => {
        await expect(
          service.submitReport('comedor', 'estado_desconocido', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });
      });
    });

    describe('rectorado', () => {
      it('acepta estados válidos en inglés y español', async () => {
        mockStore.submitReport.mockResolvedValue({ updated: true, votesCount: 3, message: 'ok' });

        await service.submitReport('rectorado', 'empty_window', 'user-1');
        await service.submitReport('rectorado', 'Ventanilla vacía', 'user-2');

        expect(mockStore.submitReport).toHaveBeenCalledTimes(2);
      });

      it('rechaza estado no permitido para rectorado', async () => {
        await expect(
          service.submitReport('rectorado', 'fluid', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });
      });
    });

    describe('biblioteca', () => {
      it('acepta aforos válidos entre 0 y 100 con fieldName "occupancy"', async () => {
        mockStore.submitReport.mockResolvedValue({ updated: false, votesCount: 1, message: 'ok' });

        await service.submitReport('biblioteca_floor_1', '0', 'user-1');
        await service.submitReport('biblioteca_floor_2', '50', 'user-2');
        await service.submitReport('biblioteca_floor_4', '100', 'user-3');

        expect(mockStore.submitReport).toHaveBeenCalledWith(
          'biblioteca_floor_1',
          '0',
          'user-1',
          'occupancy',
          expect.any(Array)
        );
      });

      it('rechaza aforos menores a 0, mayores a 100 o no numéricos', async () => {
        await expect(
          service.submitReport('biblioteca_floor_1', '-5', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });

        await expect(
          service.submitReport('biblioteca_floor_1', '105', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });

        await expect(
          service.submitReport('biblioteca_floor_1', 'mucho_aforo', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });
      });
    });

    describe('campus_alert', () => {
      it('acepta alertas en inglés y español', async () => {
        mockStore.submitReport.mockResolvedValue({ updated: true, votesCount: 3, message: 'ok' });

        await service.submitReport('campus_alert', 'cultural_event', 'user-1');
        await service.submitReport('campus_alert', 'Pérdida de DNI', 'user-2');

        expect(mockStore.submitReport).toHaveBeenCalledTimes(2);
      });

      it('rechaza estados de alerta no permitidos', async () => {
        await expect(
          service.submitReport('campus_alert', 'emergencia_general', 'user-1')
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'ERR_RADAR_INVALID_STATUS',
        });
      });
    });
  });
});
