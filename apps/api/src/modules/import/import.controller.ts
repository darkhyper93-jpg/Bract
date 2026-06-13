import type { Request, Response, NextFunction } from 'express';
import { extractTopicsSchema, extractFileFieldsSchema, commitImportSchema } from '@bract/shared';
import { AppError } from '../../lib/errors.js';
import { importService } from './import.service.js';

// Controller: SOLO HTTP. Valida con Zod (schemas de @bract/shared), llama al service, responde con
// el envelope. Todas las rutas son [self] (scopeadas a req.user!.id).
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

  // Paso 1 (variante ARCHIVO) — EXTRACT desde un archivo subido (PDF/.txt/.md/.pptx). multer ya dejó
  // el archivo en req.file (validado tipo+tamaño); el service lo convierte a texto y reusa el pipeline.
  async extractFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) throw new AppError('VALIDATION_ERROR', 'Falta el archivo a importar');
      const { subjectName } = extractFileFieldsSchema.parse(req.body);
      const preview = await importService.extractPreviewFromFile({
        filename: file.originalname,
        buffer: file.buffer,
        ...(subjectName !== undefined ? { subjectName } : {}),
      });
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
