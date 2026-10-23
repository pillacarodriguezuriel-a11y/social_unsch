import path from 'path';
import dotenv from 'dotenv';

/**
 * Carga variables de entorno desde archivos .env, sin sobrescribir las ya definidas en el proceso.
 *
 * Orden de búsqueda (gana el primero que define cada variable):
 *   1. apps/api/.env  — ubicación recomendada desde la etapa 3.
 *   2. .env en la raíz del repositorio — compatibilidad con instalaciones anteriores.
 *
 * La ruta se calcula desde este archivo, que está a la misma profundidad en src/ y en dist/.
 * En plataformas que inyectan variables (Render), no hay archivos y no se carga nada.
 */
const apiRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(apiRoot, '..', '..');

let loaded = false;

export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;
  dotenv.config({
    path: [path.join(apiRoot, '.env'), path.join(repoRoot, '.env')],
    quiet: true,
  });
}

loadEnvFiles();
