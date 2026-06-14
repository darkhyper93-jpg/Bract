import { Router } from 'express';
import { preferencesController } from './preferences.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Preferencias de estudio (Agente I-2) — rutas §5.5. Montado en /api/v1. [self]: authenticate + req.user.id.
const router: Router = Router();

router.get('/preferences', authenticate, preferencesController.get);
router.put('/preferences', authenticate, preferencesController.update);

export { router as preferencesRouter };
