import type { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service.js';
import { notificationListQuerySchema, notificationIdParamSchema } from '@bract/shared';

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = notificationListQuerySchema.parse(req.query);
      const result = await notificationService.listNotifications(req.user!.id, query);
      res.json({
        success: true,
        data: { notifications: result.items, unreadCount: result.unreadCount },
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = notificationIdParamSchema.parse(req.params);
      const notification = await notificationService.markNotificationRead(id, req.user!.id);
      res.json({ success: true, data: { notification } });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.markAllNotificationsRead(req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = notificationIdParamSchema.parse(req.params);
      await notificationService.deleteNotification(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
