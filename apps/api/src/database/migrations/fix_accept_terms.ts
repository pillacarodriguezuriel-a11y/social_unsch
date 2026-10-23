import { pool } from '../../config/database';

async function fixUsers() {
  try {
    // Marcar todos los usuarios como que han aceptado los términos
    const result = await pool.query(
      "UPDATE users SET has_accepted_terms = true WHERE has_accepted_terms = false RETURNING email"
    );
    if (result.rows.length > 0) {
      console.log(`[Fix]: has_accepted_terms actualizado para ${result.rows.length} usuarios:`);
      result.rows.forEach((r: any) => console.log(`  - ${r.email}`));
    } else {
      console.log('[Fix]: Todos los usuarios ya tienen has_accepted_terms = true');
    }
  } catch (err: any) {
    console.error('[Fix]: Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixUsers();
