import type { Request, Response, NextFunction } from 'express';
import { updatePreferencesSchema } from '@bract/shared';
import { preferencesService } from './preferences.service.js';

// Controller: SOLO HTTP. Envelope { success, data }. Rutas [self] (scope a req.user!.id en el service).
export const preferencesController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = await preferencesService.get(req.user!.id);
      res.json({ success: true, data: { preferences } });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updatePreferencesSchema.parse(req.body);
      const preferences = await preferencesService.update(req.user!.id, input);
      res.json({ success: true, data: { preferences } });
    } catch (err) {
      next(err);
    }
  },
};
