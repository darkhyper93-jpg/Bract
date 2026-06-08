import { NotificationType } from './api.types';

export interface NotificationItem {
  id: string;
  userId?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
