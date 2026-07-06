import fs from 'fs';
import path from 'path';
import { pool } from '../../config/database';

async function runCanonicalMigration() {
  console.log('[Migration]: Iniciando ejecución de la migración de datos canónicos...');
  try {
    const sqlPath = path.join(__dirname, 'add_canonical_data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('[Migration]: Datos canónicos (facultades, escuelas, pabellones, alertas de campus) creados/verificados con éxito.');
  } catch (error) {
    console.error('[Migration]: Error al ejecutar la migración canónica:', error);
  } finally {
    await pool.end();
  }
}

runCanonicalMigration();
