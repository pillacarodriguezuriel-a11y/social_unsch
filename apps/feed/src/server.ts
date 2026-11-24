import http from 'http';
import { loadFeedConfig, FeedConfigError } from './config/env';
import { createFeedPool } from './config/database';
import { createFeedAuthGuard } from './middlewares/auth.middleware';
import { createFeedApp } from './app';

async function bootstrap() {
  let config;
  try {
    config = loadFeedConfig();
  } catch (err) {
    if (err instanceof FeedConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    console.error('Error fatal al cargar la configuración de Feed:', err);
    process.exit(1);
  }

  for (const warning of config.warnings) {
    console.warn(`[Config-Aviso]: ${warning}`);
  }

  console.log(`[Feed]: Iniciando servicio '${config.serviceName}' en entorno ${config.nodeEnv}...`);

  const pool = createFeedPool(config.databaseUrl);
  const authGuard = createFeedAuthGuard({ jwtPublicKey: config.jwtPublicKey });

  const app = createFeedApp({
    pool,
    authGuard,
    allowedOrigins: config.allowedOrigins,
    serviceName: config.serviceName,
  });

  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`[Feed]: Escuchando en el puerto ${config.port} (PID ${process.pid})`);
    console.log(`[Feed]: Health check disponible en http://localhost:${config.port}/health/ready`);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Feed]: Señal ${signal} recibida. Iniciando cierre ordenado...`);

    const timeout = setTimeout(() => {
      console.error('[Feed]: Tiempo de espera agotado (10s). Forzando salida.');
      process.exit(1);
    }, 10000);

    server.close(async () => {
      console.log('[Feed]: Servidor HTTP cerrado.');
      try {
        await pool.end();
        console.log('[Feed]: Pool de PostgreSQL cerrado.');
      } catch (err: any) {
        console.warn('[Feed]: Error al cerrar el pool, continuando:', err.message);
      }
      clearTimeout(timeout);
      console.log('[Feed]: Cierre completado.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[Feed]: Fallo durante el arranque:', err);
    process.exit(1);
  });
}
