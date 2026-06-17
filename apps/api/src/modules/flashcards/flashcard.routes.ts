import { Router } from 'express';
import { flashcardController } from './flashcard.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Flashcards + SRS (Agente D) — rutas §5.5. Montado en /api/v1. Todas [self]: `authenticate`
// + scope a req.user!.id en el service. Rutas específicas ANTES de las paramétricas.
const router: Router = Router();

// /due y /:id/review antes de /:id para que Express no capture "due" como un id.
router.get('/flashcards/due', authenticate, flashcardController.listDue);
router.get('/flashcards', authenticate, flashcardController.listByTopic);
router.post('/flashcards', authenticate, flashcardController.create);
// Multi-tema (body { topicIds[], count? }). Ruta literal → sin colisión con /flashcards/:id (no hay POST /:id).
router.post('/flashcards/generate', authenticate, flashcardController.generateMulti);
router.post('/topics/:topicId/flashcards/generate', authenticate, flashcardController.generate);
router.post('/flashcards/:id/review', authenticate, flashcardController.review);
router.patch('/flashcards/:id', authenticate, flashcardController.update);
router.delete('/flashcards/:id', authenticate, flashcardController.delete);

export { router as flashcardRouter };
