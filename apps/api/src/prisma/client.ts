import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// DECISIÓN: singleton via module cache (Express no hace hot-reload en producción;
// en dev ts-node-dev mantiene el proceso vivo, por lo que el módulo se carga una vez)
function createPrismaClient() {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

export const prisma = createPrismaClient();
