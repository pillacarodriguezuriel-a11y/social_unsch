import fs from 'fs';
import path from 'path';
import { pool } from '../../config/database';

async function runSeed() {
  console.log('[Seed]: Iniciando la inserción de datos semilla (Seed Data)...');
  try {
    const sqlPath = path.join(__dirname, 'seed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);
    console.log('[Seed]: Datos semilla y perfiles de prueba insertados exitosamente.');
  } catch (error) {
    console.error('[Seed]: Error al ejecutar el script de seed:', error);
  } finally {
    await pool.end();
  }
}

runSeed();
