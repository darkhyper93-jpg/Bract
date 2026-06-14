import { Router } from 'express';
import { quizController } from './quiz.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Evaluación / Quiz (Agente I) — rutas §5.5. Montado en /api/v1. Todas [self]: `authenticate` + scope
// a req.user!.id en el service (no hay gate de rol, igual que planner/flashcards/chat/import). Ruta
// específica (`/quiz/attempts`) ANTES de la paramétrica (`/quiz/attempts/:id`).
const router: Router = Router();

router.post('/quiz/attempts', authenticate, quizController.generate); // GENERAR (crea intento IN_PROGRESS)
router.post('/quiz/attempts/:id/answers', authenticate, quizController.answer); // RESPONDER 1 pregunta
router.get('/quiz/attempts', authenticate, quizController.listAttempts);
router.get('/quiz/attempts/:id', authenticate, quizController.getAttempt);

export { router as quizRouter };
