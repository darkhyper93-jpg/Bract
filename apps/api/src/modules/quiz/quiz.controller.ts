import type { Request, Response, NextFunction } from 'express';
import {
  generateQuizSchema,
  answerQuestionSchema,
  gradeOpenItemSchema,
  quizAttemptListQuerySchema,
  quizAttemptIdParamSchema,
} from '@bract/shared';
import { quizService } from './quiz.service.js';

// Controller: SOLO HTTP. Valida con Zod (schemas de @bract/shared), llama al service, responde con el
// envelope. Toda ruta es [self] (scopeada a req.user!.id).
export const quizController = {
  // POST /quiz/attempts — GENERAR: llama a la IA, crea el intento IN_PROGRESS, devuelve preguntas públicas.
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = generateQuizSchema.parse(req.body);
      const attempt = await quizService.generate(req.user!.id, input);
      res.status(201).json({ success: true, data: { attempt } });
    } catch (err) {
      next(err);
    }
  },

  // POST /quiz/attempts/:id/answers — RESPONDER 1 pregunta (corrección server-side + lock anti-trampa).
  async answer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = quizAttemptIdParamSchema.parse(req.params);
      const input = answerQuestionSchema.parse(req.body);
      const reveal = await quizService.answer(id, req.user!.id, input);
      res.json({ success: true, data: { reveal } });
    } catch (err) {
      next(err);
    }
  },

  // POST /quiz/attempts/:id/grade — CORREGIR/REINTENTAR 1 abierta ya respondida (corrección aparte).
  // Idempotente: si ya está corregida devuelve el reveal; si la IA falla transitoriamente devuelve un
  // reveal pendiente (sin error) y el cliente reintenta.
  async grade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = quizAttemptIdParamSchema.parse(req.params);
      const input = gradeOpenItemSchema.parse(req.body);
      const reveal = await quizService.gradeOpenItem(id, req.user!.id, input);
      res.json({ success: true, data: { reveal } });
    } catch (err) {
      next(err);
    }
  },

  // GET /quiz/attempts — historial paginado (COMPLETED) del usuario (sin items).
  async listAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = quizAttemptListQuerySchema.parse(req.query);
      const { attempts, total } = await quizService.listAttempts(req.user!.id, query);
      res.json({
        success: true,
        data: { attempts },
        meta: {
          total,
          page: query.page,
          perPage: query.perPage,
          totalPages: Math.ceil(total / query.perPage),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /quiz/attempts/:id — intento + items completos (revisar con explicaciones).
  async getAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = quizAttemptIdParamSchema.parse(req.params);
      const attempt = await quizService.getAttempt(id, req.user!.id);
      res.json({ success: true, data: { attempt } });
    } catch (err) {
      next(err);
    }
  },
};
