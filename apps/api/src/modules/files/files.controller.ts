import type { Request, Response, NextFunction } from 'express';
import { fileUploadRequestSchema } from '@bract/shared';
import { filesService } from './files.service.js';

export const filesController = {
  async requestUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = fileUploadRequestSchema.parse(req.body);
      const result = await filesService.requestUploadUrl(req.user!.id, dto);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async confirmUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await filesService.confirmUpload(req.user!.id, req.params['id']!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await filesService.deleteFile(req.user!.id, req.params['id']!);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
};
