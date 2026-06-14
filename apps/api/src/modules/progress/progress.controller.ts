import type { Request, Response, NextFunction } from 'express';
import { weakTopicsQuerySchema } from '@bract/shared';
import { progressService } from './progress.service.js';

// Controller: SOLO HTTP. Envelope { success, data }. Rutas [self] (scope a req.user!.id en el service).
export const progressController = {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await progressService.getOverview(req.user!.id);
      res.json({ success: true, data: { overview } });
    } catch (err) {
      next(err);
    }
  },

  async getWeakTopics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit } = weakTopicsQuerySchema.parse(req.query);
      const weakTopics = await progressService.getWeakTopics(req.user!.id, limit);
      res.json({ success: true, data: { weakTopics } });
    } catch (err) {
      next(err);
    }
  },
};
