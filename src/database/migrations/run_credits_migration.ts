import fs from 'fs';
import path from 'path';
import { pool } from '../../config/database';

async function runCreditsMigration() {
  console.log('[Migration]: Iniciando ejecución de DDL para Sistema de Créditos y Wiki-Banco...');
  try {
    const sqlPath = path.join(__dirname, 'credits_and_wiki.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);
    console.log('[Migration]: Tablas, triggers y funciones de créditos creados/verificados con éxito.');
  } catch (error) {
    console.error('[Migration]: Error al ejecutar la migración de créditos:', error);
  } finally {
    await pool.end();
  }
}

runCreditsMigration();
