import type { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';
import { GetUsersQuerySchema, updateUserRoleSchema, updateUserStatusSchema, updateProfileSchema } from '@bract/shared';

export const usersController = {
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = GetUsersQuerySchema.parse(req.query);
      const result = await usersService.listUsers(query);
      res.json({ success: true, data: { users: result.items }, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await usersService.getUserById(id!);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const dto = updateProfileSchema.parse(req.body);
      const user = await usersService.updateUser(req.user!.id, id!, dto);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async changeUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const dto = updateUserRoleSchema.parse(req.body);
      const ip = req.ip;
      const ua = req.headers['user-agent'];

      const user = await usersService.changeUserRole(req.user!.id, id!, dto.role, {
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      });

      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async changeUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const dto = updateUserStatusSchema.parse(req.body);
      const ip = req.ip;
      const ua = req.headers['user-agent'];

      const user = await usersService.changeUserStatus(req.user!.id, id!, dto.status, {
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      });

      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const ip = req.ip;
      const ua = req.headers['user-agent'];

      await usersService.deleteUser(req.user!.id, id!, {
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      });

      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
};
