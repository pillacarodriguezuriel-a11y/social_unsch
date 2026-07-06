import fs from 'fs';
import path from 'path';
import { pool } from '../../config/database';

async function runModerationMigration() {
  console.log('[Migration]: Iniciando ejecución de DDL para Moderación y Carpooling...');
  try {
    const sqlPath = path.join(__dirname, 'moderation_and_carpooling.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);
    console.log('[Migration]: Tablas, triggers y estructuras de carpooling y moderación creadas/verificadas con éxito.');
  } catch (error) {
    console.error('[Migration]: Error al ejecutar la migración de moderación/carpooling:', error);
  } finally {
    await pool.end();
  }
}

runModerationMigration();
