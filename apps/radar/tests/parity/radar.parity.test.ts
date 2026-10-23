import { RadarRepository as RemoteRadarRepository } from '../../src/modules/radar/radar.repository';
import { RadarService as RemoteRadarService } from '../../src/modules/radar/radar.service';
import {
  RADAR_NODES,
  RADAR_TTL_SECONDS,
  RADAR_UNDEFINED_VALUE,
  RADAR_VOTE_THRESHOLD,
} from '@social-unsch/contracts';

describe('apps/radar - Pruebas de Paridad de Contratos y Almacén (Modo Local vs Servicio Independiente)', () => {
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, { status: 'Fluido', isDefinite: 'true' }],
          [null, { status: 'empty_window', isDefinite: 'true' }],
          [null, { occupancy: '50', isDefinite: 'true' }],
          [null, { occupancy: '80', isDefinite: 'true' }],
          [null, {}],
          [null, {}],
          [null, { status: 'Evento cultural', isDefinite: 'true' }],
        ]),
      }),
      eval: jest.fn().mockResolvedValue([1, 3, 'Estado actualizado']),
    };
  });

  it('el servicio independiente utiliza exactamente las mismas 7 claves de hash para consultar el estado', async () => {
    const remoteRepo = new RemoteRadarRepository(mockRedis);
    await remoteRepo.getStatus();

    const pipelineInstance = mockRedis.pipeline();
    expect(mockRedis.pipeline).toHaveBeenCalled();

    // Verificamos las llamadas a hgetall en el pipeline
    const hgetallCalls = pipelineInstance.hgetall.mock.calls.map((c: any) => c[0]);
    expect(hgetallCalls).toEqual([
      'radar:comedor:status',
      'radar:rectorado:status',
      'radar:biblioteca:floor:1:occupancy',
      'radar:biblioteca:floor:2:occupancy',
      'radar:biblioteca:floor:3:occupancy',
      'radar:biblioteca:floor:4:occupancy',
      'radar:campus_alert:status',
    ]);
  });

  it('el servicio independiente pasa exactamente el umbral de 3 votos y TTL de 900s al script Lua', async () => {
    const remoteRepo = new RemoteRadarRepository(mockRedis);
    const remoteService = new RemoteRadarService(remoteRepo);

    await remoteService.submitReport('comedor', 'fluid', 'user-abc');

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const [, , key1, key2, userId, statusVal, ttlArg, thresholdArg] = mockRedis.eval.mock.calls[0];

    expect(key1).toBe('radar:comedor:reports:fluid');
    expect(key2).toBe('radar:comedor:status');
    expect(userId).toBe('user-abc');
    expect(statusVal).toBe('fluid');
    expect(ttlArg).toBe(RADAR_TTL_SECONDS.toString()); // '900'
    expect(thresholdArg).toBe(RADAR_VOTE_THRESHOLD.toString()); // '3'
  });

  it('la paridad bilingüe genera el mismo espacio de claves tanto para alias en español como en inglés', async () => {
    const remoteRepo = new RemoteRadarRepository(mockRedis);
    const remoteService = new RemoteRadarService(remoteRepo);

    // Voto en español
    await remoteService.submitReport('comedor', 'Cola Media', 'user-1');
    const callEsp = mockRedis.eval.mock.calls[0];
    expect(callEsp[2]).toBe('radar:comedor:reports:Cola_Media');

    // Voto en inglés
    await remoteService.submitReport('comedor', 'medium_queue', 'user-2');
    const callEng = mockRedis.eval.mock.calls[1];
    expect(callEng[2]).toBe('radar:comedor:reports:medium_queue');

    // Voto en biblioteca para verificar la clave targetStateKey específica de piso
    await remoteService.submitReport('biblioteca_floor_2', '60', 'user-3');
    const callBiblio = mockRedis.eval.mock.calls[2];
    expect(callBiblio[3]).toBe('radar:biblioteca:floor:2:occupancy');
  });

  it('un estado no registrado en Redis se mapea a RADAR_UNDEFINED_VALUE (indefinido) con is_definite: false', async () => {
    const remoteRepo = new RemoteRadarRepository(mockRedis);
    const status = await remoteRepo.getStatus();

    expect(status.biblioteca.floor_3.occupancy).toBe(RADAR_UNDEFINED_VALUE);
    expect(status.biblioteca.floor_3.is_definite).toBe(false);
    expect(status.biblioteca.floor_4.occupancy).toBe(RADAR_UNDEFINED_VALUE);
    expect(status.biblioteca.floor_4.is_definite).toBe(false);
  });
});
