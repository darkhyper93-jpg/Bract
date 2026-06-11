import express, { type Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { loggerMiddleware } from './middleware/logger.middleware.js';
import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
// Para cleanup síncrono (reemplaza cleanupWorker + cleanupQueue)
import { filesRepository } from './modules/files/files.repository.js';
import { deleteObject } from './lib/r2.js';
import { FILE_LIMITS } from './config/constants.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { plannerRouter } from './modules/planner/planner.routes.js';
import { flashcardRouter } from './modules/flashcards/flashcard.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { docsRouter } from './routes/docs.routes.js';

export const app: Express = express();

// Middleware order — README §(agent spec): requestId → cors → helmet → json → cookies → logger → rate limit → routes → error
app.use(requestIdMiddleware);
app.use(corsMiddleware);
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(loggerMiddleware);
app.use(globalRateLimiter);

// Health check — available without auth
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Fase 2 — Auth module
app.use('/api/v1/auth', authRouter);

// Fase 3 — Profile module
app.use('/api/v1/profile', profileRouter);

// Fase 3 — Users module (admin)
app.use('/api/v1/users', usersRouter);

// Fase 3 — Files module
app.use('/api/v1/files', filesRouter);

// Fase 5 — Notifications module
app.use('/api/v1/notifications', notificationRouter);

// Fase 6 — Analytics module
app.use('/api/v1/analytics', analyticsRouter);

// Fase 7 — Admin module
app.use('/api/v1/admin', adminRouter);

// Fase 10 — Planificador (Agente C): materias / temas / disponibilidad / plan
app.use('/api/v1', plannerRouter);

// Fase 11 — Flashcards + SRS (Agente D): CRUD + generación IA + repaso espaciado
app.use('/api/v1', flashcardRouter);

// Fase 12 — Chat de estudio (Agente E): sesiones + mensajes con contexto y streaming (SSE)
app.use('/api/v1', chatRouter);

// Fase 8 — API Documentation
app.use('/api/v1/docs', docsRouter);

app.use(errorHandler);

// DECISIÓN: BullMQ desactivado para MVP (Upstash free tier no soporta conexiones TCP
// persistentes que BullMQ requiere). Ver error.md.
// email.worker, notification.worker, report.worker: la lógica se ejecuta inline
// en cada service. cleanup.worker: reemplazado por setInterval nativo.
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

async function runCleanup(): Promise<void> {
  try {
    const stale = await filesRepository.findPendingOlderThan(FILE_LIMITS.PENDING_EXPIRY_MINUTES);
    let removed = 0;
    for (const record of stale) {
      try {
        await deleteObject(record.key);
        await filesRepository.softDelete(record.id);
        logger.info('cleanup: stale file removed', { fileId: record.id, key: record.key });
        removed++;
      } catch (err) {
        logger.error('cleanup: failed to remove stale file', {
          fileId: record.id,
          error: (err as Error).message,
        });
      }
    }
    if (removed > 0) {
      logger.info('cleanup-pending-files completed', { removed });
    }
  } catch (err) {
    logger.error('cleanup job failed', { error: (err as Error).message });
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | undefined;

// Start server only when this file is the entry point (not during testing)
if (process.env['NODE_ENV'] !== 'test') {
  const port = env.PORT;
  app.listen(port, () => {
    logger.info(`Bract API running at ${env.APP_URL}`);
  });

  cleanupInterval = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);

  logger.info('Server ready (cleanup interval started)');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  clearInterval(cleanupInterval);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  clearInterval(cleanupInterval);
  process.exit(0);
});
