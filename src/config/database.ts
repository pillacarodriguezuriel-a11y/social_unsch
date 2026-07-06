import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('Advertencia: La variable de entorno DATABASE_URL no está definida. Las consultas fallarán si no se establece conexión.');
}

// Configuración del Pool de conexiones para PostgreSQL
export const pool = new Pool({
  connectionString,
  // Opciones recomendadas para producción
  max: 20, // Máximo número de clientes concurrentes
  idleTimeoutMillis: 30000, // Tiempo de inactividad antes de cerrar la conexión
  connectionTimeoutMillis: 2000, // Tiempo límite para establecer conexión
});

// Comprobar conexión inicial
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de conexiones de base de datos:', err);
});
