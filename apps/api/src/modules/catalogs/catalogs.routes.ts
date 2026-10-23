import { Router } from 'express';
import { CatalogsController } from './catalogs.controller';

const router = Router();
const catalogsController = new CatalogsController();

// Rutas públicas de consulta de catálogos persistidos
router.get('/', catalogsController.getCatalogs);
router.get('/schools', catalogsController.getSchools);

export default router;
