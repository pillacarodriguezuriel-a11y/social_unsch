import { redis } from '../../config/redis';

export interface RadarStatusResponse {
  comedor: {
    status: string;
    is_definite: boolean;
  };
  rectorado: {
    status: string;
    is_definite: boolean;
  };
  biblioteca: {
    floor_1: { occupancy: string | number; is_definite: boolean };
    floor_2: { occupancy: string | number; is_definite: boolean };
    floor_3: { occupancy: string | number; is_definite: boolean };
    floor_4: { occupancy: string | number; is_definite: boolean };
  };
  campus_alert: {
    status: string;
    is_definite: boolean;
  };
}

export class RadarRepository {
  // Definición del script Lua para votación y agregación atómica
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
    const pipeline = redis.pipeline();
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
        return { value: 'indefinido', isDefinite: false };
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
    const campusAlertInfo = parseNodeStatus(results[6], 'status');

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
        floor_1: { occupancy: b1Info.value, is_definite: b1Info.isDefinite },
        floor_2: { occupancy: b2Info.value, is_definite: b2Info.isDefinite },
        floor_3: { occupancy: b3Info.value, is_definite: b3Info.isDefinite },
        floor_4: { occupancy: b4Info.value, is_definite: b4Info.isDefinite },
      },
      campus_alert: {
        status: campusAlertInfo.value as string,
        is_definite: campusAlertInfo.isDefinite,
      },
    };
  }

  /**
   * Ejecuta el script Lua de forma atómica en Redis para registrar un reporte.
   * @param node Nombre del nodo
   * @param statusValue Valor de estado reportado
   * @param userId Identificador del usuario votante
   * @param fieldName Nombre del campo a actualizar ("status" o "occupancy")
   * @param allSets Claves de los Sets de reporte a borrar al mutar de estado
   */
  async submitReport(
    node: string,
    statusValue: string,
    userId: string,
    fieldName: 'status' | 'occupancy',
    allSets: string[]
  ): Promise<{ updated: boolean; votesCount: number; message: string }> {
    const setKey = `radar:${node}:reports:${statusValue.replace(/\s+/g, '_')}`;
    let hashKey = `radar:${node}:status`;
    if (node.startsWith('biblioteca_floor_')) {
      const floor = node.replace('biblioteca_floor_', '');
      hashKey = `radar:biblioteca:floor:${floor}:occupancy`;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    const ttl = '900'; // 15 minutos de Time-To-Live
    const threshold = '3'; // Se requieren 3 votos coincidentes

    // Invocar la ejecución del script Lua
    const rawResult = await redis.eval(
      this.luaVoteScript,
      2, // Número de llaves
      setKey,
      hashKey,
      userId,
      statusValue,
      ttl,
      threshold,
      currentTimestamp,
      fieldName,
      allSets.length.toString(),
      ...allSets
    );

    const [updated, votesCount, message] = rawResult as [number, number, string];

    if (votesCount === -1) {
      // El usuario ya reportó este estado
      return {
        updated: false,
        votesCount: 0,
        message,
      };
    }

    return {
      updated: updated === 1,
      votesCount,
      message,
    };
  }
}
