import axios, { AxiosInstance } from 'axios';

// Crear instancia global del cliente HTTP Axios
export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Solicitudes: inyectar Bearer token automáticamente
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de Respuestas: interceptar errores 401 para destruir sesión y redirigir
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        // Destruir credenciales de sesión localmente por seguridad
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirigir al inicio de sesión
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
