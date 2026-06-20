import type { Request, Response, NextFunction } from 'express';
import { gamificationService } from './gamification.service.js';

// Controller: SOLO HTTP. Envelope { success, data }. Ruta [self] (scope a req.user!.id en el service).
export const gamificationController = {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await gamificationService.getSummary(req.user!.id);
      res.json({ success: true, data: { summary } });
    } catch (err) {
      next(err);
    }
  },
};
