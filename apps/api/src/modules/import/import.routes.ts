import { Router } from 'express';
import { importController } from './import.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Importación masiva de temas POR TEXTO (Agente K). Montado en /api/v1. Ambas [self]:
// `authenticate` + scope a req.user!.id en el service.
const router: Router = Router();

router.post('/import/topics/extract', authenticate, importController.extract);
router.post('/import/topics/commit', authenticate, importController.commit);

export { router as importRouter };
