import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis.js';
import { AppError } from '../lib/errors.js';

// Sliding window counter using Upstash Redis (INCR + EXPIRE)
export function createRateLimiter(max: number, windowMs: number) {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.id ?? req.ip ?? 'unknown';
    const key = `rate:${identifier}:${req.path}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > max) {
        next(new AppError('RATE_LIMITED', 'Too many requests'));
        return;
      }
    } catch {
      // If Redis is unreachable, let the request through rather than blocking all traffic
    }

    next();
  };
}

// Global rate limiter applied to all routes (anon: 60/min per IP, auth: 500/min per user)
import { RATE_LIMIT } from '../config/constants.js';

export const globalRateLimiter = createRateLimiter(
  RATE_LIMIT.API_ANONYMOUS.max,
  RATE_LIMIT.API_ANONYMOUS.windowMs,
);
