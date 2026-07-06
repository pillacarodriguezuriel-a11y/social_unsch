import fs from 'fs';
import path from 'path';
import { pool } from '../../config/database';

async function runMigration() {
  console.log('[Migration]: Iniciando ejecución de DDL de Base y Matchmaking...');
  try {
    // 1. Ejecutar esquema base
    const baseSqlPath = path.join(__dirname, 'base_schema.sql');
    const baseSql = fs.readFileSync(baseSqlPath, 'utf8');
    await pool.query(baseSql);
    console.log('[Migration]: Tablas base del sistema (facultades, escuelas, pabellones, usuarios) creadas.');

    // 2. Ejecutar esquema de matchmaking
    const matchmakingSqlPath = path.join(__dirname, 'matchmaking.sql');
    const matchmakingSql = fs.readFileSync(matchmakingSqlPath, 'utf8');
    await pool.query(matchmakingSql);
    console.log('[Migration]: Tablas de matchmaking creadas/verificadas con éxito.');
  } catch (error) {
    console.error('[Migration]: Error al ejecutar la migración:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
