import { Worker, Job } from 'bullmq';
import { bullmqConnection } from './queues.js';
import { logger } from '../lib/logger.js';
import { JOB, FILE_LIMITS } from '../config/constants.js';
import { filesRepository } from '../modules/files/files.repository.js';
import { deleteObject } from '../lib/r2.js';

export const cleanupWorker = new Worker(
  'cleanup',
  async (job: Job) => {
    if (job.name === 'cleanup-pending-files') {
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

      logger.info('cleanup-pending-files completed', { removed });
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
    lockDuration: JOB.MAX_DURATION_MS,
  },
);

cleanupWorker.on('completed', (job) => {
  logger.info('cleanup job completed', { jobId: job.id });
});

cleanupWorker.on('failed', (job, err) => {
  logger.error('cleanup job failed', { jobId: job?.id, error: err.message });
});
