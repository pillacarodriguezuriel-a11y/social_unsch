import type Redis from 'ioredis';
import {
  RADAR_TTL_SECONDS,
  RADAR_UNDEFINED_VALUE,
  RADAR_VOTE_THRESHOLD,
  RadarStatusResponse,
} from '@social-unsch/contracts';

export type { RadarStatusResponse };

export type RadarRedisClient = Pick<Redis, 'pipeline' | 'eval'>;

export interface RadarVoteResult {
  updated: boolean;
  votesCount: number;
  message: string;
}

export interface RadarStore {
  getStatus(): Promise<RadarStatusResponse>;
  submitReport(
    node: string,
    statusValue: string,
    userId: string,
    fieldName: 'status' | 'occupancy',
    allSets: string[]
  ): Promise<RadarVoteResult>;
}

export class RadarRepository implements RadarStore {
  constructor(private readonly redis: RadarRedisClient) {}

  // Script Lua atómico idéntico para votación, agregación y TTL
  private luaVoteScript = `
    local already_voted = redis.call('SISMEMBER', KEYS[1], ARGV[1])
    if already_voted == 1 then
      return {0, -1, "Ya reportaste este estado en la ventana actual"}
    end

    redis.call('SADD', KEYS[1], ARGV[1])
    redis.call('EXPIRE', KEYS[1], ARGV[3])

    local vote_count = redis.call('SCARD', KEYS[1])

    if vote_count >= tonumber(ARGV[4]) then
      -- Actualizar el estado global en el Hash
      redis.call('HSET', KEYS[2], ARGV[6], ARGV[2], 'report_count', tostring(vote_count), 'last_updated', ARGV[5])
      redis.call('EXPIRE', KEYS[2], ARGV[3])
      
      -- Resetear los trackers locales (borrar sets de reporte para evitar interferencias)
      local num_keys_to_delete = tonumber(ARGV[7])
      for i = 1, num_keys_to_delete do
        redis.call('DEL', ARGV[7 + i])
      end
      
      return {1, vote_count, "Estado actualizado"}
    end

    return {0, vote_count, "Reporte registrado, esperando más confirmaciones"}
  `;

  /**
   * Lee simultáneamente el estado de todos los nodos del Campus Radar vía pipelines.
   */
  async getStatus(): Promise<RadarStatusResponse> {
    const pipeline = this.redis.pipeline();
    pipeline.hgetall('radar:comedor:status');
    pipeline.hgetall('radar:rectorado:status');
    pipeline.hgetall('radar:biblioteca:floor:1:occupancy');
    pipeline.hgetall('radar:biblioteca:floor:2:occupancy');
    pipeline.hgetall('radar:biblioteca:floor:3:occupancy');
    pipeline.hgetall('radar:biblioteca:floor:4:occupancy');
    pipeline.hgetall('radar:campus_alert:status');

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Error al ejecutar pipeline de Redis');
    }

    const parseNodeStatus = (res: any, field: 'status' | 'occupancy') => {
      const data = res[1] as Record<string, string> | null;
      if (!data || Object.keys(data).length === 0) {
        return { value: RADAR_UNDEFINED_VALUE, isDefinite: false };
      }
      return {
        value: field === 'occupancy' ? Number(data.occupancy) : data.status,
        isDefinite: true,
      };
    };

    const comedorInfo = parseNodeStatus(results[0], 'status');
    const rectoradoInfo = parseNodeStatus(results[1], 'status');
    const b1Info = parseNodeStatus(results[2], 'occupancy');
    const b2Info = parseNodeStatus(results[3], 'occupancy');
    const b3Info = parseNodeStatus(results[4], 'occupancy');
    const b4Info = parseNodeStatus(results[5], 'occupancy');
    const alertInfo = parseNodeStatus(results[6], 'status');

    return {
      comedor: {
        status: comedorInfo.value as string,
        is_definite: comedorInfo.isDefinite,
      },
      rectorado: {
        status: rectoradoInfo.value as string,
        is_definite: rectoradoInfo.isDefinite,
      },
      biblioteca: {
        floor_1: {
          occupancy: b1Info.value as number | typeof RADAR_UNDEFINED_VALUE,
          is_definite: b1Info.isDefinite,
        },
        floor_2: {
          occupancy: b2Info.value as number | typeof RADAR_UNDEFINED_VALUE,
          is_definite: b2Info.isDefinite,
        },
        floor_3: {
          occupancy: b3Info.value as number | typeof RADAR_UNDEFINED_VALUE,
          is_definite: b3Info.isDefinite,
        },
        floor_4: {
          occupancy: b4Info.value as number | typeof RADAR_UNDEFINED_VALUE,
          is_definite: b4Info.isDefinite,
        },
      },
      campus_alert: {
        status: alertInfo.value as string,
        is_definite: alertInfo.isDefinite,
      },
    };
  }

  /**
   * Ejecuta el registro atómico del voto y actualización de estado en Redis.
   */
  async submitReport(
    node: string,
    statusValue: string,
    userId: string,
    fieldName: 'status' | 'occupancy',
    allSets: string[]
  ): Promise<RadarVoteResult> {
    const safeStatusKey = statusValue.replace(/\s+/g, '_');
    const voteKey = `radar:${node}:reports:${safeStatusKey}`;
    const targetStateKey = node.startsWith('biblioteca_floor_')
      ? `radar:biblioteca:floor:${node.split('_')[2]}:occupancy`
      : `radar:${node}:status`;

    const ttl = RADAR_TTL_SECONDS.toString();
    const threshold = RADAR_VOTE_THRESHOLD.toString();
    const now = new Date().toISOString();

    const keys = [voteKey, targetStateKey];
    const args = [
      userId,
      statusValue,
      ttl,
      threshold,
      now,
      fieldName,
      allSets.length.toString(),
      ...allSets,
    ];

    const result = (await this.redis.eval(
      this.luaVoteScript,
      keys.length,
      ...keys,
      ...args
    )) as [number, number, string];

    const updated = result[0] === 1;
    const votesCount = result[1] === -1 ? 0 : result[1];
    const message = result[2];

    return {
      updated,
      votesCount,
      message,
    };
  }
}
