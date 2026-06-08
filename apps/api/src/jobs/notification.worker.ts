import { Worker, type Job } from 'bullmq';
import { bullmqConnection } from './queues.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../lib/logger.js';
import { JOB } from '../config/constants.js';
import type { CreateNotificationJobData } from './notification.producer.js';

async function processNotificationJob(job: Job<CreateNotificationJobData>): Promise<void> {
  const { userId, type, title, body, data } = job.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    logger.info('notification job skipped — user not active', { jobId: job.id, userId });
    return;
  }

  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? null,
    },
  });
}

export const notificationWorker = new Worker<CreateNotificationJobData>(
  'notification',
  processNotificationJob,
  {
    connection: bullmqConnection,
    concurrency: 10,
    lockDuration: JOB.MAX_DURATION_MS,
  },
);

notificationWorker.on('completed', (job) => {
  logger.info('notification job completed', { jobId: job.id });
});

notificationWorker.on('failed', (job, err) => {
  logger.error('notification job failed', { jobId: job?.id, error: err.message });
});
