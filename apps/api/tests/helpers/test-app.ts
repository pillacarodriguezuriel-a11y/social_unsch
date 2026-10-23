/**
 * Construcción de la aplicación para pruebas.
 *
 * Desde la etapa 3 la aplicación no se crea al importar src/app: se compone con createApp() y
 * recibe sus dependencias. Aquí se monta el radar local con un cliente Redis falso (o el que se
 * indique) y sin comprobaciones de salud, salvo que la prueba las aporte.
 */
import { Application } from 'express';
import { createApp } from '../../src/app';
import { DependencyCheck } from '../../src/health/health.routes';
import { createLocalRadarModule, LocalRadarDependencies, RadarModule } from '../../src/modules/radar/radar.module';

export interface FakeRedis {
  pipeline: jest.Mock;
  eval: jest.Mock;
  ping: jest.Mock;
}

export function createFakeRedis(): FakeRedis {
  return {
    pipeline: jest.fn(),
    eval: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  };
}

export interface TestAppOptions {
  redis?: unknown;
  radar?: RadarModule;
  readinessChecks?: DependencyCheck[];
  allowedOrigins?: string[];
}

export function createTestApp(options: TestAppOptions = {}): Application {
  const redis = (options.redis ?? createFakeRedis()) as LocalRadarDependencies['redis'];
  return createApp({
    radar: options.radar ?? createLocalRadarModule({ redis }),
    readinessChecks: options.readinessChecks ?? [],
    allowedOrigins: options.allowedOrigins,
  });
}
