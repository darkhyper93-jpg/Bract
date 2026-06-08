import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../lib/redis.js';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { JWTPayload } from '@bract/shared';
import { Role } from '@bract/shared';

const BLACKLIST_PREFIX = 'blacklist:';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const publicKey = env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as JWTPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired token');
    }

    // Check Redis blacklist — token is revoked if present
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await redis.get(`${BLACKLIST_PREFIX}${tokenHash}`);
    if (blacklisted) {
      throw new AppError('UNAUTHORIZED', 'Token has been revoked');
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('UNAUTHORIZED', 'Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      next(new AppError('FORBIDDEN', 'Insufficient permissions'));
      return;
    }
    next();
  };
}

// DECISIÓN: middleware separado en lugar de authorize() inline — permite reutilización limpia en rutas — ver README §5.5
export function authorizeSelfOrAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError('UNAUTHORIZED', 'Not authenticated'));
    return;
  }
  const isAdmin = req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN;
  const isSelf = req.user.id === req.params['id'];
  if (!isAdmin && !isSelf) {
    next(new AppError('FORBIDDEN', 'Insufficient permissions'));
    return;
  }
  next();
}
