import type { Notification } from '@prisma/client';
import { notificationRepository } from './notification.repository.js';
import { AppError } from '../../lib/errors.js';
import type { NotificationItem, NotificationListResponse, NotificationListQuery } from '@bract/shared';

function toItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data as Record<string, unknown> | null,
    read: n.read,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationService = {
  async listNotifications(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const unread =
      query.unread === 'true' ? true : query.unread === 'false' ? false : undefined;

    const { items, total, unreadCount } = await notificationRepository.findManyByUser({
      userId,
      page: query.page,
      perPage: query.perPage,
      ...(unread !== undefined ? { unread } : {}),
    });

    return {
      items: items.map(toItem),
      unreadCount,
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },

  async markNotificationRead(id: string, userId: string): Promise<NotificationItem> {
    const notification = await notificationRepository.findOneByIdAndUser(id, userId);
    if (!notification) {
      throw new AppError('NOT_FOUND', 'Notificación no encontrada');
    }
    if (notification.read) {
      return toItem(notification);
    }
    const updated = await notificationRepository.markAsRead(id);
    return toItem(updated);
  },

  async markAllNotificationsRead(userId: string): Promise<{ count: number }> {
    return notificationRepository.markAllAsRead(userId);
  },

  async deleteNotification(id: string, userId: string): Promise<void> {
    const notification = await notificationRepository.findOneByIdAndUser(id, userId);
    if (!notification) {
      throw new AppError('NOT_FOUND', 'Notificación no encontrada');
    }
    await notificationRepository.deleteById(id);
  },
};
