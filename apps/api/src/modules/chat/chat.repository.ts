import { prisma } from '../../prisma/client.js';
import type { ChatMessage, ChatSession } from '@prisma/client';

// Repositorio del Chat de estudio (Agente E) — SOLO Prisma. ChatMessage NO tiene userId:
// la pertenencia se valida vía el padre (ChatSession.userId) en el service (§3.4).

export type ChatSessionWithMessagesRow = ChatSession & { messages: ChatMessage[] };
export type ChatSessionOwnerRow = { id: string; userId: string; title: string | null };

export const chatRepository = {
  // ---- Sesiones ----
  // Lista por usuario, recientes primero (índice @@index([userId, updatedAt])). Sin N+1.
  findManyByUserPaged(userId: string, page: number, perPage: number): Promise<ChatSession[]> {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
  },

  countByUser(userId: string): Promise<number> {
    return prisma.chatSession.count({ where: { userId } });
  },

  // Sesión + hilo ordenado en UNA query (índice @@index([sessionId, createdAt])). Sin N+1.
  findByIdAndUserWithMessages(
    id: string,
    userId: string,
  ): Promise<ChatSessionWithMessagesRow | null> {
    return prisma.chatSession.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  },

  // Owner mínimo: valida pertenencia (vía padre) sin traer el hilo entero.
  findOwner(id: string): Promise<ChatSessionOwnerRow | null> {
    return prisma.chatSession.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true },
    });
  },

  create(userId: string, title: string | null): Promise<ChatSession> {
    return prisma.chatSession.create({ data: { userId, title } });
  },

  updateTitle(id: string, title: string): Promise<ChatSession> {
    return prisma.chatSession.update({ where: { id }, data: { title } });
  },

  // Toca updatedAt para reordenar la lista de sesiones recientes tras un mensaje.
  touch(id: string): Promise<ChatSession> {
    return prisma.chatSession.update({ where: { id }, data: { updatedAt: new Date() } });
  },

  async deleteById(id: string): Promise<void> {
    await prisma.chatSession.delete({ where: { id } });
  },

  // ---- Mensajes ----
  // Historial reciente para el modelo, acotado a `take` (por tokens/costo). Se trae en orden
  // descendente y el service lo invierte a cronológico.
  findRecentMessages(sessionId: string, take: number): Promise<ChatMessage[]> {
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  createMessage(
    sessionId: string,
    role: ChatMessage['role'],
    content: string,
  ): Promise<ChatMessage> {
    return prisma.chatMessage.create({ data: { sessionId, role, content } });
  },
};
