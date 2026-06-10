import { prisma } from '../../prisma/client.js';
import type { Prisma, Subject, Topic } from '@prisma/client';

// Fila materia + sus temas (árbol del planner / contexto del chat). Sin N+1: un solo include.
export type SubjectWithTopicsRow = Subject & { topics: Topic[] };

export const subjectRepository = {
  // Orden por urgencia (examen más cercano primero; nulls al final), luego por creación.
  findManyByUserWithTopics(userId: string): Promise<SubjectWithTopicsRow[]> {
    return prisma.subject.findMany({
      where: { userId },
      orderBy: [{ examDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      include: { topics: { orderBy: { createdAt: 'asc' } } },
    });
  },

  findByIdAndUserWithTopics(id: string, userId: string): Promise<SubjectWithTopicsRow | null> {
    return prisma.subject.findFirst({
      where: { id, userId },
      include: { topics: { orderBy: { createdAt: 'asc' } } },
    });
  },

  findByIdAndUser(id: string, userId: string): Promise<Subject | null> {
    return prisma.subject.findFirst({ where: { id, userId } });
  },

  create(data: Prisma.SubjectUncheckedCreateInput): Promise<Subject> {
    return prisma.subject.create({ data });
  },

  update(id: string, data: Prisma.SubjectUpdateInput): Promise<Subject> {
    return prisma.subject.update({ where: { id }, data });
  },

  async deleteById(id: string): Promise<void> {
    await prisma.subject.delete({ where: { id } });
  },
};
