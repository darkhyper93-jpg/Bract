// notification.producer.ts
// DECISIÓN: En lugar de BullMQ, creamos notificaciones directamente en Prisma.
// Esto evita la dependencia de ioredis/BullMQ en producción (Upstash free tier
// no soporta conexiones TCP persistentes). Ver error.md.
// Para el futuro: restaurar el enqueue a notificationQueue
// y arrancar notificationWorker en server.ts.
import { prisma } from '../prisma/client.js';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import type { NotificationType } from '@bract/shared';

export interface CreateNotificationJobData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function enqueueCreateNotification(
  jobData: CreateNotificationJobData,
  _options?: { priority?: number },
): Promise<void> {
  const { userId, type, title, body, data } = jobData;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    logger.info('notification skipped — user not active', { userId });
    return;
  }
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      ...(data != null ? { data: data as Prisma.InputJsonValue } : {}),
    },
  });
}
