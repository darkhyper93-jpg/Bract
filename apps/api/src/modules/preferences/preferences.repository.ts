import type { Prisma, UserStudyPreferences as PrismaPrefs } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

// Repositorio de preferencias (I-2). Solo Prisma. 1:1 con User (userId @unique) → upsert.
export const preferencesRepository = {
  async findByUser(userId: string): Promise<PrismaPrefs | null> {
    return prisma.userStudyPreferences.findUnique({ where: { userId } });
  },

  async upsert(userId: string, data: Prisma.UserStudyPreferencesUpdateInput): Promise<PrismaPrefs> {
    return prisma.userStudyPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        // spread primero: el connect explícito gana y evita TS2783 (data nunca trae `user` en runtime).
        ...(data as Prisma.UserStudyPreferencesCreateInput),
        user: { connect: { id: userId } },
      },
    });
  },
};
