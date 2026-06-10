import { Router } from 'express';
import { plannerController } from './planner.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Planificador (Agente C) — rutas §5.5. Montado en /api/v1. Todas [self]: `authenticate`
// + scope a req.user!.id en el service. Rutas específicas ANTES de las paramétricas.
const router: Router = Router();

// ---- Materias ----
router.get('/subjects', authenticate, plannerController.listSubjects);
router.post('/subjects', authenticate, plannerController.createSubject);
router.get('/subjects/:id', authenticate, plannerController.getSubject);
router.patch('/subjects/:id', authenticate, plannerController.updateSubject);
router.delete('/subjects/:id', authenticate, plannerController.deleteSubject);

// ---- Temas ----
router.get('/subjects/:subjectId/topics', authenticate, plannerController.listTopics);
router.post('/subjects/:subjectId/topics', authenticate, plannerController.createTopic);
// /status antes de /:id para que Express no capture "status" como parte de otra ruta
router.patch('/topics/:id/status', authenticate, plannerController.updateTopicStatus);
router.patch('/topics/:id', authenticate, plannerController.updateTopic);
router.delete('/topics/:id', authenticate, plannerController.deleteTopic);

// ---- Disponibilidad ----
router.get('/study/availability', authenticate, plannerController.getAvailability);
router.put('/study/availability', authenticate, plannerController.setAvailability);

// ---- Plan ----
// /plan/generate y /plan/items/:id antes de /plan (más específicas primero)
router.post('/study/plan/generate', authenticate, plannerController.generatePlan);
router.patch('/study/plan/items/:id', authenticate, plannerController.updatePlanItem);
router.get('/study/plan', authenticate, plannerController.getPlan);

export { router as plannerRouter };
