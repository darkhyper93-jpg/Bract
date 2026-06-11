import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Chat de estudio (Agente E) — rutas §5.5. Montado en /api/v1. Todas [self]: `authenticate`
// + scope a req.user!.id (pertenencia de ChatMessage vía ChatSession.userId en el service).
// El POST de mensajes responde en STREAMING (SSE), no con el envelope JSON — ver error.md.
const router: Router = Router();

router.get('/chat/sessions', authenticate, chatController.listSessions);
router.post('/chat/sessions', authenticate, chatController.createSession);
router.get('/chat/sessions/:id', authenticate, chatController.getSession);
router.delete('/chat/sessions/:id', authenticate, chatController.deleteSession);
router.post('/chat/sessions/:id/messages', authenticate, chatController.sendMessage);

export { router as chatRouter };
