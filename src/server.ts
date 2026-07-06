import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.APP_PORT || 3000;

const server = app.listen(port, () => {
  console.log(`[Server]: Servidor activo escuchando en el puerto ${port} en modo ${process.env.NODE_ENV || 'development'}`);
});

// Manejo gracioso del apagado del servidor para cerrar conexiones abiertas
process.on('SIGTERM', () => {
  console.log('[Server]: Señal SIGTERM recibida. Cerrando servidor...');
  server.close(() => {
    console.log('[Server]: Servidor cerrado limpiamente.');
    process.exit(0);
  });
});
