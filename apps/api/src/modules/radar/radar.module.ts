import type Redis from 'ioredis';
import { Router } from 'express';
import { RadarController } from './radar.controller';
import { RadarRedisClient, RadarRepository } from './radar.repository';
import { createRadarRouter } from './radar.routes';
import { RadarService } from './radar.service';

/**
 * Unidad montable del Radar. La aplicación la monta en /api/v1/radar sin saber si las
 * solicitudes se atienden en este proceso (modo local) o en otro servicio (modo proxy).
 */
export interface RadarModule {
  mode: 'local' | 'proxy';
  router: Router;
  /** true si el radar puede atender solicitudes en este momento. Nunca lanza. */
  checkReady(): Promise<boolean>;
}

export interface LocalRadarDependencies {
  /** Cliente Redis creado por la composición; el módulo no abre conexiones por su cuenta. */
  redis: RadarRedisClient & Pick<Redis, 'ping'>;
}

/** Radar atendido dentro de la API (modo por defecto). */
export function createLocalRadarModule({ redis }: LocalRadarDependencies): RadarModule {
  const service = new RadarService(new RadarRepository(redis));
  const controller = new RadarController(service);
  return {
    mode: 'local',
    router: createRadarRouter(controller),
    async checkReady() {
      try {
        return (await redis.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
  };
}
