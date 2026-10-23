import Redis from 'ioredis';
import { getTestRedis } from './helpers/test-environment';
import { RadarService } from '../../src/modules/radar/radar.service';
import { redis as appRedis } from '../../src/config/redis';

describe('Real Radar Engine with Redis (Redis 7 Real)', () => {
  let redis: Redis;
  let radarService: RadarService;

  beforeAll(async () => {
    redis = getTestRedis();
    radarService = new RadarService();
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Limpiar claves del radar en el Redis de pruebas antes de cada test
    const keys = await redis.keys('radar:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it('Scenario 1: Registro de votos y rechazo de duplicados según el contrato vigente', async () => {
    const user1 = 'user-radar-uuid-001';

    // 1. Primer voto legítimo para el nodo comedor
    const vote1 = await radarService.submitReport('comedor', 'fluid', user1);
    expect(vote1.updated).toBe(false);
    expect(vote1.votesCount).toBe(1);
    expect(vote1.message).toBe('Reporte registrado, esperando más confirmaciones');

    // 2. Intento de voto duplicado del mismo usuario en la misma ventana de tiempo
    const duplicateVote = await radarService.submitReport('comedor', 'fluid', user1);
    expect(duplicateVote.updated).toBe(false);
    expect(duplicateVote.votesCount).toBe(0);
    expect(duplicateVote.message).toBe('Ya reportaste este estado en la ventana actual');

    // 3. Verificar que en Redis el Set contiene solo 1 elemento
    const setMembers = await redis.smembers('radar:comedor:reports:fluid');
    expect(setMembers).toEqual([user1]);
  });

  it('Scenario 2: Consenso alcanzado al completar 3 usuarios distintos', async () => {
    const user1 = 'user-radar-uuid-001';
    const user2 = 'user-radar-uuid-002';
    const user3 = 'user-radar-uuid-003';

    // Voto 1
    const res1 = await radarService.submitReport('comedor', 'fluid', user1);
    expect(res1.updated).toBe(false);
    expect(res1.votesCount).toBe(1);

    // Voto 2
    const res2 = await radarService.submitReport('comedor', 'fluid', user2);
    expect(res2.updated).toBe(false);
    expect(res2.votesCount).toBe(2);

    // Voto 3 (alcanza el umbral de consenso de 3 votos)
    const res3 = await radarService.submitReport('comedor', 'fluid', user3);
    expect(res3.updated).toBe(true);
    expect(res3.votesCount).toBe(3);
    expect(res3.message).toBe('Estado actualizado');
  });

  it('Scenario 3: Lectura del estado consolidado con pipelines de Redis', async () => {
    // Inicialmente todos los nodos están indefinidos
    const initialStatus = await radarService.getStatus();
    expect(initialStatus.comedor.is_definite).toBe(false);
    expect(initialStatus.comedor.status).toBe('indefinido');
    expect(initialStatus.rectorado.is_definite).toBe(false);

    // 3 votos para 'rectorado' -> 'waiting_15'
    await radarService.submitReport('rectorado', 'waiting_15', 'usr-a');
    await radarService.submitReport('rectorado', 'waiting_15', 'usr-b');
    await radarService.submitReport('rectorado', 'waiting_15', 'usr-c');

    // 3 votos para 'biblioteca_floor_2' -> '75'
    await radarService.submitReport('biblioteca_floor_2', '75', 'usr-a');
    await radarService.submitReport('biblioteca_floor_2', '75', 'usr-b');
    await radarService.submitReport('biblioteca_floor_2', '75', 'usr-c');

    // Consultar estado consolidado vía getStatus()
    const updatedStatus = await radarService.getStatus();
    expect(updatedStatus.rectorado.is_definite).toBe(true);
    expect(updatedStatus.rectorado.status).toBe('waiting_15');

    expect(updatedStatus.biblioteca.floor_2.is_definite).toBe(true);
    expect(updatedStatus.biblioteca.floor_2.occupancy).toBe(75);

    // Los pisos no reportados siguen indefinidos
    expect(updatedStatus.biblioteca.floor_1.is_definite).toBe(false);
  });

  it('Scenario 4: Verificación de TTL razonable en Redis (<= 900 segundos)', async () => {
    // 3 votos para consolidar estado del comedor
    await radarService.submitReport('comedor', 'medium_queue', 'usr-x');
    await radarService.submitReport('comedor', 'medium_queue', 'usr-y');
    await radarService.submitReport('comedor', 'medium_queue', 'usr-z');

    // Inspeccionar TTL del Hash de estado en Redis
    const ttl = await redis.ttl('radar:comedor:status');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
    // Verificamos que no sea un TTL degenerado o infinito (-1 o -2)
    expect(ttl).toBeGreaterThan(800);
  });

  it('Scenario 5: Rechazo de nodos o estados inválidos protegiendo la integridad de Redis', async () => {
    await expect(radarService.submitReport('nodo_inexistente', 'fluid', 'usr-1')).rejects.toThrow(
      'El nodo del radar especificado no es válido.'
    );

    await expect(radarService.submitReport('comedor', 'estado_invalido_xyz', 'usr-1')).rejects.toThrow(
      'El estado reportado para el comedor no es válido.'
    );

    await expect(radarService.submitReport('biblioteca_floor_1', '150', 'usr-1')).rejects.toThrow(
      'El aforo de la biblioteca debe ser un porcentaje entero entre 0 y 100.'
    );
  });
});
