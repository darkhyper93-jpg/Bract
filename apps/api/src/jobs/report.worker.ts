import { Worker, Job } from 'bullmq';
import { bullmqConnection } from './queues.js';
import { logger } from '../lib/logger.js';
import { JOB } from '../config/constants.js';

// Worker vacío con estructura base — implementación completa en Fase 6
export const reportWorker = new Worker(
  'report',
  async (job: Job) => {
    logger.info('report job received', { jobId: job.id, jobName: job.name });
    // TODO: Fase 6 — implement report generation and R2 export
  },
  {
    connection: bullmqConnection,
    concurrency: 2,
    lockDuration: JOB.MAX_DURATION_MS,
  },
);

reportWorker.on('completed', (job) => {
  logger.info('report job completed', { jobId: job.id });
});

reportWorker.on('failed', (job, err) => {
  logger.error('report job failed', { jobId: job?.id, error: err.message });
});
