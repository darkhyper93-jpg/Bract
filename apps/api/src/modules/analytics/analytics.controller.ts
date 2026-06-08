import type { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';
import { analyticsQuerySchema } from '@bract/shared';

export const analyticsController = {
  async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getOverview();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getUserGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = analyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getUserGrowthSeries(days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = analyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getActivitySeries(days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
