import { prisma } from '../../prisma/client.js';
import type { Prisma, Topic } from '@prisma/client';

export const topicRepository = {
  findManyBySubject(subjectId: string): Promise<Topic[]> {
    return prisma.topic.findMany({ where: { subjectId }, orderBy: { createdAt: 'asc' } });
  },

  // userId denormalizado → ownership directo sin join (§3.4).
  findByIdAndUser(id: string, userId: string): Promise<Topic | null> {
    return prisma.topic.findFirst({ where: { id, userId } });
  },

  create(data: Prisma.TopicUncheckedCreateInput): Promise<Topic> {
    return prisma.topic.create({ data });
  },

  update(id: string, data: Prisma.TopicUpdateInput): Promise<Topic> {
    return prisma.topic.update({ where: { id }, data });
  },

  async deleteById(id: string): Promise<void> {
    await prisma.topic.delete({ where: { id } });
  },
};
