import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { JOB } from '../config/constants.js';

// DECISIÓN: BullMQ requiere conexión TCP ioredis, no Upstash REST API.
// Usamos BULLMQ_REDIS_URL (rediss://default:token@host:port) del entorno.
export const bullmqConnection = new IORedis(env.BULLMQ_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
});

const defaultJobOptions = {
  attempts: JOB.RETRY_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: JOB.BACKOFF_DELAY_MS,
  },
};

export const emailQueue = new Queue('email', {
  connection: bullmqConnection,
  defaultJobOptions,
});

export const notificationQueue = new Queue('notification', {
  connection: bullmqConnection,
  defaultJobOptions,
});

export const reportQueue = new Queue('report', {
  connection: bullmqConnection,
  defaultJobOptions,
});

export const cleanupQueue = new Queue('cleanup', {
  connection: bullmqConnection,
  defaultJobOptions,
});
