import type { Request, Response, NextFunction } from 'express';
import {
  createSubjectSchema,
  updateSubjectSchema,
  subjectIdParamSchema,
  subjectIdParamForTopicsSchema,
  createTopicSchema,
  updateTopicSchema,
  updateTopicStatusSchema,
  topicIdParamSchema,
  setAvailabilitySchema,
  generatePlanSchema,
  updatePlanItemSchema,
  planItemIdParamSchema,
} from '@bract/shared';
import { plannerService } from './planner.service.js';

// Controller: SOLO HTTP. Valida con Zod (schemas de @bract/shared), llama al service,
// responde con el envelope. Toda ruta es [self] (scopeada a req.user!.id).
export const plannerController = {
  // ---- Materias ----
  async listSubjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjects = await plannerService.listSubjects(req.user!.id);
      res.json({ success: true, data: { subjects } });
    } catch (err) {
      next(err);
    }
  },

  async createSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createSubjectSchema.parse(req.body);
      const subject = await plannerService.createSubject(req.user!.id, input);
      res.status(201).json({ success: true, data: { subject } });
    } catch (err) {
      next(err);
    }
  },

  async getSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      const subject = await plannerService.getSubject(id, req.user!.id);
      res.json({ success: true, data: { subject } });
    } catch (err) {
      next(err);
    }
  },

  async updateSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      const input = updateSubjectSchema.parse(req.body);
      const subject = await plannerService.updateSubject(id, req.user!.id, input);
      res.json({ success: true, data: { subject } });
    } catch (err) {
      next(err);
    }
  },

  async deleteSubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      await plannerService.deleteSubject(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ---- Temas ----
  async listTopics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId } = subjectIdParamForTopicsSchema.parse(req.params);
      const topics = await plannerService.listTopics(subjectId, req.user!.id);
      res.json({ success: true, data: { topics } });
    } catch (err) {
      next(err);
    }
  },

  async createTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId } = subjectIdParamForTopicsSchema.parse(req.params);
      const input = createTopicSchema.parse(req.body);
      const topic = await plannerService.createTopic(subjectId, req.user!.id, input);
      res.status(201).json({ success: true, data: { topic } });
    } catch (err) {
      next(err);
    }
  },

  async updateTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = topicIdParamSchema.parse(req.params);
      const input = updateTopicSchema.parse(req.body);
      const topic = await plannerService.updateTopic(id, req.user!.id, input);
      res.json({ success: true, data: { topic } });
    } catch (err) {
      next(err);
    }
  },

  async deleteTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = topicIdParamSchema.parse(req.params);
      await plannerService.deleteTopic(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // Completar/cambiar estado de un tema → dispara recálculo. Devuelve { topic, plan }.
  async updateTopicStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = topicIdParamSchema.parse(req.params);
      const { status } = updateTopicStatusSchema.parse(req.body);
      const result = await plannerService.updateTopicStatus(id, req.user!.id, status);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // ---- Disponibilidad ----
  async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const availability = await plannerService.getAvailability(req.user!.id);
      res.json({ success: true, data: { availability } });
    } catch (err) {
      next(err);
    }
  },

  async setAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = setAvailabilitySchema.parse(req.body);
      const availability = await plannerService.setAvailability(req.user!.id, input);
      res.json({ success: true, data: { availability } });
    } catch (err) {
      next(err);
    }
  },

  // ---- Plan ----
  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await plannerService.getActivePlan(req.user!.id);
      res.json({ success: true, data: { plan } });
    } catch (err) {
      next(err);
    }
  },

  async generatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      generatePlanSchema.parse(req.body ?? {});
      const plan = await plannerService.generatePlan(req.user!.id);
      res.status(201).json({ success: true, data: { plan } });
    } catch (err) {
      next(err);
    }
  },

  // Marcar bloque del día (COMPLETED/SKIPPED). Devuelve { item, plan } (SKIPPED recalcula).
  async updatePlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = planItemIdParamSchema.parse(req.params);
      const { status } = updatePlanItemSchema.parse(req.body);
      const result = await plannerService.updatePlanItem(id, req.user!.id, status);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
