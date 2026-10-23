import { pool } from '../../config/database';

export class UsersRepository {
  /**
   * Actualiza el estado de aceptación de términos del usuario en la base de datos de manera atómica.
   * @param userId UUID del usuario
   */
  async acceptTerms(userId: string): Promise<boolean> {
    const query = {
      name: 'update-accept-terms',
      text: 'UPDATE users SET has_accepted_terms = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      values: [userId],
    };

    const result = await pool.query(query);
    return (result.rowCount ?? 0) > 0;
  }
}
