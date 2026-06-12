import type { Request, Response, NextFunction } from 'express';
import { extractTopicsSchema, commitImportSchema } from '@bract/shared';
import { importService } from './import.service.js';

// Controller: SOLO HTTP. Valida con Zod (schemas de @bract/shared), llama al service, responde con
// el envelope. Ambas rutas son [self] (scopeadas a req.user!.id).
export const importController = {
  // Paso 1 — EXTRACT: devuelve el preview de temas (no escribe en DB).
  async extract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = extractTopicsSchema.parse(req.body);
      const preview = await importService.extractPreview(input);
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  },

  // Paso 2 — COMMIT: persiste los temas confirmados sobre la materia destino (add/replace).
  async commit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = commitImportSchema.parse(req.body);
      const result = await importService.commitImport(req.user!.id, input);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
