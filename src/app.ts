import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import radarRoutes from './modules/radar/radar.routes';
import feedRoutes from './modules/feed/feed.routes';
import matchmakingRoutes from './modules/matchmaking/matchmaking.routes';
import carpoolingRoutes from './modules/carpooling/carpooling.routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app: Application = express();

// Middleware de seguridad Helmet
app.use(helmet());

// Configuración de CORS basada en variables de entorno o valores por defecto seguros
const defaultOrigins = ['https://social.unsch.edu.pe'];

// En desarrollo local siempre permitir localhost
if (process.env.NODE_ENV !== 'production') {
  defaultOrigins.push('http://localhost:3001', 'http://localhost:3000');
}

const allowedOriginsList = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin cabecera de origen (como clientes REST, cURL, etc.)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOriginsList.includes(origin) || allowedOriginsList.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error('Bloqueado por la política de CORS de la aplicación.'));
    },
    credentials: true,
  })
);

// Habilitar el análisis de cuerpos JSON y formularios URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Registrar las rutas del módulo de autenticación bajo el prefijo universal /api/v1/auth
app.use('/api/v1/auth', authRoutes);

// Registrar las rutas del módulo de usuarios bajo el prefijo universal /api/v1/users
app.use('/api/v1/users', usersRoutes);

// Registrar las rutas de Campus Radar bajo el prefijo universal /api/v1/radar
app.use('/api/v1/radar', radarRoutes);

// Registrar las rutas del feed académico bajo el prefijo universal /api/v1/feed
app.use('/api/v1/feed', feedRoutes);

// Registrar las rutas del emparejamiento académico bajo el prefijo universal /api/v1/matchmaking
app.use('/api/v1/matchmaking', matchmakingRoutes);

// Registrar las rutas de carpooling bajo el prefijo universal /api/v1/carpooling
app.use('/api/v1/carpooling', carpoolingRoutes);

// Middleware centralizado de manejo de errores (debe registrarse al final)
app.use(errorMiddleware);

export default app;
