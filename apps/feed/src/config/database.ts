import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Pool de PostgreSQL del servicio Feed.
 *
 * `max: 10` es la parte de este servicio en el presupuesto de conexiones
 * compartido con la API (ver docs/02-arquitectura-software/06-datos-y-propiedad-por-dominio.md).
 */
export function createFeedPool(databaseUrl: string): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  // Sin este manejador, un error en un cliente inactivo se emite sin escucha y
  // termina el proceso. No se registra la cadena de conexión.
  pool.on('error', (err) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'social-unsch-feed',
        level: 'error',
        event: 'pg_pool_error',
        message: err.message,
      })
    );
  });
  return pool;
}
