import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from './app';
import { AppResources, createAppResources } from './composition';
import { ServerConfig } from './config/env';

export interface RunningServer {
  server: Server;
  port: number;
  /** Deja de aceptar conexiones y cierra PostgreSQL y Redis. Idempotente. */
  stop(): Promise<void>;
}

/** Arranca la API con una configuración ya validada. */
export async function startServer(
  config: ServerConfig,
  createResources: (config: ServerConfig) => AppResources = createAppResources
): Promise<RunningServer> {
  const resources = createResources(config);
  const app = createApp(resources.deps);

  let server: Server;
  try {
    server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(config.port, () => resolve(s));
      s.once('error', reject);
    });
  } catch (error) {
    await resources.close();
    throw error;
  }

  let stopping: Promise<void> | null = null;
  const stop = () => {
    if (!stopping) {
      stopping = new Promise<void>((resolve) => server.close(() => resolve())).then(() => resources.close());
    }
    return stopping;
  };

  return { server, port: (server.address() as AddressInfo).port, stop };
}
