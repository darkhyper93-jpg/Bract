import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '@bract/shared';
import { AppError } from '../../lib/errors.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth/refresh',
};

function getRefreshCookie(req: Request): string | undefined {
  // cookies is populated by cookie-parser middleware
  const val: unknown = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME];
  return typeof val === 'string' ? val : undefined;
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth/refresh' });
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = RegisterSchema.parse(req.body);
      const result = await authService.register(dto);

      res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(201).json({
        success: true,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = LoginSchema.parse(req.body);
      const ip = req.ip;
      const ua = req.headers['user-agent'];

      const result = await authService.login({
        ...dto,
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      });

      res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);
      res.json({
        success: true,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rawRefreshToken = getRefreshCookie(req);
      const authHeader = req.headers['authorization'] ?? '';
      const rawAccessToken = authHeader.replace(/^Bearer\s+/i, '');

      if (rawRefreshToken) {
        await authService.logout({ userId, rawRefreshToken, rawAccessToken });
      }

      clearRefreshCookie(res);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = getRefreshCookie(req);
      if (!rawRefreshToken) {
        throw new AppError('UNAUTHORIZED', 'No refresh token provided');
      }

      const ip = req.ip;
      const ua = req.headers['user-agent'];

      const result = await authService.refresh({
        rawRefreshToken,
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(ua !== undefined ? { userAgent: ua } : {}),
      });

      res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);
      res.json({
        success: true,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.me(req.user!.id);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = ForgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(dto);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = ResetPasswordSchema.parse(req.body);
      await authService.resetPassword(dto);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = VerifyEmailSchema.parse(req.query);
      await authService.verifyEmail(dto);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
};
