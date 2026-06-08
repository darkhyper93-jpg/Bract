import type { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { auditLogQuerySchema } from '@bract/shared';

export const adminController = {
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const result = await adminService.getAuditLogs(query);
      res.json({ success: true, data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminService.getStats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
