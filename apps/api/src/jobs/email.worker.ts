import { Worker, Job } from 'bullmq';
import { bullmqConnection } from './queues.js';
import { emailService } from '../lib/email.js';
import { logger } from '../lib/logger.js';
import { JOB } from '../config/constants.js';

type EmailJobData =
  | { type: 'welcome'; to: string; name: string }
  | { type: 'passwordReset'; to: string; token: string };

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { data } = job;
  switch (data.type) {
    case 'welcome':
      await emailService.sendWelcome(data.to, data.name);
      break;
    case 'passwordReset':
      await emailService.sendPasswordReset(data.to, data.token);
      break;
    default: {
      const _exhaustive: never = data;
      logger.error('email worker: unknown job type', { jobId: job.id, data: _exhaustive });
    }
  }
}

export const emailWorker = new Worker<EmailJobData>('email', processEmailJob, {
  connection: bullmqConnection,
  concurrency: 5,
  lockDuration: JOB.MAX_DURATION_MS,
});

emailWorker.on('completed', (job) => {
  logger.info('email job completed', { jobId: job.id, type: job.data.type });
});

emailWorker.on('failed', (job, err) => {
  logger.error('email job failed', { jobId: job?.id, type: job?.data?.type, error: err.message });
});
