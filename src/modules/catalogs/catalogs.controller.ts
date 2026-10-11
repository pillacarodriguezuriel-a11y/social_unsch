import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';

export class CatalogsController {
  /**
   * GET /api/v1/catalogs
   * Retorna el catálogo unificado de facultades, escuelas profesionales y pabellones
   * persistidos en la base de datos con sus identificadores reales.
   */
  getCatalogs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const facultiesQuery = 'SELECT id, name, abbreviation FROM faculties ORDER BY id ASC';
      const schoolsQuery = 'SELECT id, faculty_id, name, code FROM professional_schools ORDER BY name ASC';
      const pavilionsQuery = 'SELECT code, name FROM campus_pavilions ORDER BY code ASC';

      const [facultiesRes, schoolsRes, pavilionsRes] = await Promise.all([
        pool.query(facultiesQuery),
        pool.query(schoolsQuery),
        pool.query(pavilionsQuery),
      ]);

      res.status(200).json({
        success: true,
        data: {
          faculties: facultiesRes.rows,
          schools: schoolsRes.rows,
          pavilions: pavilionsRes.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/catalogs/schools
   * Retorna exclusivamente las escuelas profesionales con sus IDs reales.
   */
  getSchools = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolsRes = await pool.query(
        'SELECT id, faculty_id, name, code FROM professional_schools ORDER BY name ASC'
      );
      res.status(200).json({
        success: true,
        data: schoolsRes.rows,
      });
    } catch (error) {
      next(error);
    }
  };
}
