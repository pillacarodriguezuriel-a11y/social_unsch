import http from 'http';
import { loadRadarConfig, RadarConfigError } from './config/env';
import { createRadarRedisClient } from './config/redis';
import { createRadarAuthGuard } from './middlewares/auth.middleware';
import { createRadarApp } from './app';

async function bootstrap() {
  let config;
  try {
    config = loadRadarConfig();
  } catch (err) {
    if (err instanceof RadarConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    console.error('Error fatal al cargar la configuración de Radar:', err);
    process.exit(1);
  }

  // Avisos no bloqueantes
  for (const warning of config.warnings) {
    console.warn(`[Config-Aviso]: ${warning}`);
  }

  console.log(`[Radar]: Iniciando servicio '${config.serviceName}' en entorno ${config.nodeEnv}...`);

  // Conexión Redis
  const redis = createRadarRedisClient(config.redisUrl);

  // Guardia de autenticación con clave pública
  const authGuard = createRadarAuthGuard({ jwtPublicKey: config.jwtPublicKey });

  // Crear aplicación Express
  const app = createRadarApp({
    redis,
    authGuard,
    allowedOrigins: config.allowedOrigins,
    serviceName: config.serviceName,
  });

  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`[Radar]: Escuchando en el puerto ${config.port} (PID ${process.pid})`);
    console.log(`[Radar]: Health check disponible en http://localhost:${config.port}/health/ready`);
  });

  // Cierre ordenado (graceful shutdown)
  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Radar]: Señal ${signal} recibida. Iniciando cierre ordenado...`);

    const timeout = setTimeout(() => {
      console.error('[Radar]: Tiempo de espera de cierre agotado (10s). Forzando salida.');
      process.exit(1);
    }, 10000);

    server.close(async () => {
      console.log('[Radar]: Servidor HTTP cerrado.');
      try {
        await redis.quit();
        console.log('[Radar]: Conexión con Redis cerrada.');
      } catch (err: any) {
        console.warn('[Radar]: Error al cerrar Redis ordenadamente, desconectando forzoso:', err.message);
        redis.disconnect();
      }
      clearTimeout(timeout);
      console.log('[Radar]: Cierre completado.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[Radar]: Fallo durante el arranque:', err);
    process.exit(1);
  });
}
