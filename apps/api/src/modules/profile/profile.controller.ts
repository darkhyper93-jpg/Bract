import type { Request, Response, NextFunction } from 'express';
import { profileService } from './profile.service.js';
import { updateProfileSchema, changePasswordSchema, type UpdateProfileInput } from '@bract/shared';

export const profileController = {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await profileService.getProfile(req.user!.id);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateProfileSchema.parse(req.body) as UpdateProfileInput;
      const user = await profileService.updateProfile(req.user!.id, dto);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = changePasswordSchema.parse(req.body);
      const authHeader = req.headers['authorization'] ?? '';
      const rawAccessToken = authHeader.replace(/^Bearer\s+/i, '');

      await profileService.changePassword(
        req.user!.id,
        { currentPassword: dto.currentPassword, newPassword: dto.newPassword },
        rawAccessToken,
      );
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async removeAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await profileService.removeAvatar(req.user!.id);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },
};
