import { Router } from 'express';
import { gamificationController } from './gamification.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Gamificación (Agente J) — rutas §5.5. Montado en /api/v1. [self]: authenticate + scope en el service.
// SOLO lectura: el XP/quests/jefe/racha se mutan server-side por efecto de acciones reales (anti-trampa).
const router: Router = Router();

router.get('/gamification/summary', authenticate, gamificationController.getSummary);

export { router as gamificationRouter };
