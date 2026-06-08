import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('request completed', {
      requestId: req.requestId,
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
}
