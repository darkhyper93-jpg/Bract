import type { Request, Response, NextFunction } from 'express';
import {
  createFlashcardSchema,
  updateFlashcardSchema,
  flashcardListQuerySchema,
  flashcardDueQuerySchema,
  generateFlashcardsParamSchema,
  generateFlashcardsBodySchema,
  generateFlashcardsMultiSchema,
  reviewFlashcardSchema,
  flashcardIdParamSchema,
} from '@bract/shared';
import { flashcardService } from './flashcard.service.js';

// Controller: SOLO HTTP. Valida con Zod (schemas de @bract/shared), llama al service,
// responde con el envelope. Toda ruta es [self] (scopeada a req.user!.id).
export const flashcardController = {
  // GET /flashcards?topicId=... — cartas de un tema (paginado, envelope con meta).
  async listByTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = flashcardListQuerySchema.parse(req.query);
      const { flashcards, total } = await flashcardService.listByTopic(req.user!.id, query);
      res.json({
        success: true,
        data: { flashcards },
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

  // GET /flashcards/due — cartas due del usuario (SRS), con contexto de tema/materia.
  async listDue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = flashcardDueQuerySchema.parse(req.query);
      const flashcards = await flashcardService.listDue(req.user!.id, query);
      res.json({ success: true, data: { flashcards } });
    } catch (err) {
      next(err);
    }
  },

  // POST /flashcards — crear manual.
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createFlashcardSchema.parse(req.body);
      const flashcard = await flashcardService.create(req.user!.id, input);
      res.status(201).json({ success: true, data: { flashcard } });
    } catch (err) {
      next(err);
    }
  },

  // POST /topics/:topicId/flashcards/generate — generar con IA per-tema (vía Agente B).
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topicId } = generateFlashcardsParamSchema.parse(req.params);
      const { count } = generateFlashcardsBodySchema.parse(req.body ?? {});
      const flashcards = await flashcardService.generate(topicId, req.user!.id, count);
      res.status(201).json({ success: true, data: { flashcards } });
    } catch (err) {
      next(err);
    }
  },

  // POST /flashcards/generate — generar con IA sobre un set de temas (multi). Éxito parcial: el `meta`
  // reporta cuántas cartas generó cada tema y cuáles fallaron (el front avisa los no generados).
  async generateMulti(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topicIds, count } = generateFlashcardsMultiSchema.parse(req.body);
      const { flashcards, meta } = await flashcardService.generateMulti(topicIds, req.user!.id, count);
      res.status(201).json({ success: true, data: { flashcards }, meta });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /flashcards/:id — editar manual (question/answer).
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = flashcardIdParamSchema.parse(req.params);
      const input = updateFlashcardSchema.parse(req.body);
      const flashcard = await flashcardService.update(id, req.user!.id, input);
      res.json({ success: true, data: { flashcard } });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /flashcards/:id.
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = flashcardIdParamSchema.parse(req.params);
      await flashcardService.delete(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // POST /flashcards/:id/review — calificación SM-2 { quality: 0|3|4|5 }.
  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = flashcardIdParamSchema.parse(req.params);
      const { quality } = reviewFlashcardSchema.parse(req.body);
      const flashcard = await flashcardService.review(id, req.user!.id, quality);
      res.json({ success: true, data: { flashcard } });
    } catch (err) {
      next(err);
    }
  },
};
