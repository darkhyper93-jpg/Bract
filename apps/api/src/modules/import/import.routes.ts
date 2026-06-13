import { Router } from 'express';
import { importController } from './import.controller.js';
import { uploadImportFile } from './import.upload.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Importación masiva de temas (Agente K: POR TEXTO + desde ARCHIVOS). Montado en /api/v1. Todas
// [self]: `authenticate` + scope a req.user!.id en el service. La ruta de archivo suma multer
// (multipart) antes del controller; las demás usan el `express.json` global.
const router: Router = Router();

router.post('/import/topics/extract', authenticate, importController.extract);
router.post('/import/topics/extract-file', authenticate, uploadImportFile, importController.extractFile);
router.post('/import/topics/commit', authenticate, importController.commit);

export { router as importRouter };
