import { RadarRepository } from '../../src/modules/radar/radar.repository';

describe('apps/radar - RadarRepository unit edge cases', () => {
  it('lanza error si pipeline.exec() devuelve null o undefined', async () => {
    const mockRedis: any = {
      pipeline: jest.fn().mockReturnValue({
        hgetall: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      }),
      eval: jest.fn(),
    };

    const repo = new RadarRepository(mockRedis);
    await expect(repo.getStatus()).rejects.toThrow('Error al ejecutar pipeline de Redis');
  });
});
