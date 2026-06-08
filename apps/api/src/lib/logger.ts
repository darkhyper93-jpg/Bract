import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'development'
          ? combine(colorize(), simple())
          : combine(timestamp(), json()),
    }),
  ],
});
