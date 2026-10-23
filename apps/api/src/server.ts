import './config/load-env';
import { ConfigError, loadServerConfig, ServerConfig } from './config/env';
import { startServer } from './bootstrap';

/** Tiempo máximo para el cierre ordenado antes de forzar la salida. */
const SHUTDOWN_TIMEOUT_MS = 10000;

async function main(): Promise<void> {
  let config: ServerConfig;
  try {
    config = loadServerConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('[Server]: ' + error.message);
      process.exit(1);
    }
    throw error;
  }
  config.warnings.forEach((w) => console.warn('[Server]: Advertencia de configuración: ' + w));

  const running = await startServer(config);
  console.log(
    '[Server]: Servidor activo escuchando en el puerto ' +
      running.port +
      ' en modo ' +
      config.nodeEnv +
      ' (radar: ' +
      config.radar.mode +
      ')'
  );

  const shutdown = (signal: string) => {
    console.log('[Server]: Señal ' + signal + ' recibida. Cerrando servidor y conexiones...');
    const force = setTimeout(() => {
      console.error('[Server]: El cierre ordenado excedió el tiempo límite; se fuerza la salida.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();
    running.stop().then(() => {
      console.log('[Server]: Servidor cerrado limpiamente.');
      process.exit(0);
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[Server]: Error fatal durante el arranque:', error instanceof Error ? error.message : error);
  process.exit(1);
});
