import { Router } from 'express';
import { progressController } from './progress.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Progreso (Agente I-2) — rutas §5.5. Montado en /api/v1. Todas [self]: authenticate + scope en el service.
const router: Router = Router();

router.get('/progress/overview', authenticate, progressController.getOverview);
router.get('/progress/weak-topics', authenticate, progressController.getWeakTopics);

export { router as progressRouter };
