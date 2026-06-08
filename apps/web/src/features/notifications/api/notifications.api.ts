import apiClient from '../../../lib/axios';
import type { NotificationItem, NotificationListQuery } from '@bract/shared';

interface NotificationListApiResponse {
  success: true;
  data: { items: NotificationItem[]; unreadCount: number };
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

interface NotificationReadApiResponse {
  success: true;
  data: NotificationItem;
}

interface NotificationReadAllApiResponse {
  success: true;
  data: { count: number };
}

export const notificationsApi = {
  async list(params: Partial<NotificationListQuery>): Promise<NotificationListApiResponse> {
    const res = await apiClient.get('/notifications', { params });
    return res.data;
  },

  async markRead(id: string): Promise<NotificationReadApiResponse> {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllRead(): Promise<NotificationReadAllApiResponse> {
    const res = await apiClient.patch('/notifications/read-all');
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
