import { prisma } from '../../prisma/client.js';
import type { Notification } from '@prisma/client';

interface FindManyParams {
  userId: string;
  page: number;
  perPage: number;
  unread?: boolean;
}

export const notificationRepository = {
  async findManyByUser(
    params: FindManyParams,
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }> {
    const { userId, page, perPage, unread } = params;
    const skip = (page - 1) * perPage;

    const whereFiltered =
      unread !== undefined ? { userId, read: !unread } : { userId };

    const [total, unreadCount, items] = await prisma.$transaction([
      prisma.notification.count({ where: whereFiltered }),
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.notification.findMany({
        where: whereFiltered,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);

    return { items, total, unreadCount };
  },

  async findOneByIdAndUser(id: string, userId: string): Promise<Notification | null> {
    return prisma.notification.findFirst({ where: { id, userId } });
  },

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { count: result.count };
  },

  async deleteById(id: string): Promise<void> {
    await prisma.notification.delete({ where: { id } });
  },
};
