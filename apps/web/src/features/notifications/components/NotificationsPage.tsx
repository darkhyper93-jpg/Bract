import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Pagination } from '../../../components/ui/Pagination';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationActions } from '../hooks/useNotificationActions';
import { notificationsApi } from '../api/notifications.api';
import { NotificationItem } from './NotificationItem';
import type { NotificationItem as NotificationItemType } from '@bract/shared';

type Filter = 'all' | 'unread';

export function NotificationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const params = {
    page,
    perPage: 20,
    ...(filter === 'unread' ? { unread: 'true' as const } : {}),
  };

  const { notifications, meta, isLoading, isError, refetch } = useNotifications(params);
  const { markAllRead, remove } = useNotificationActions();

  function handleFilterChange(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function optimisticMarkRead(id: string) {
    const key = queryKeys.notifications.list(params as Record<string, unknown>);
    queryClient.setQueryData(
      key,
      (old: { data: { items: NotificationItemType[]; unreadCount: number }; meta: unknown; success: true } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((n) =>
              n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
            ),
            unreadCount: Math.max(0, old.data.unreadCount - 1),
          },
        };
      },
    );

    notificationsApi.markRead(id).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    });
  }

  function optimisticRemove(id: string) {
    const key = queryKeys.notifications.list(params as Record<string, unknown>);
    queryClient.setQueryData(
      key,
      (old: { data: { items: NotificationItemType[]; unreadCount: number }; meta: unknown; success: true } | undefined) => {
        if (!old) return old;
        const removing = old.data.items.find((n) => n.id === id);
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.filter((n) => n.id !== id),
            unreadCount: removing && !removing.read
              ? Math.max(0, old.data.unreadCount - 1)
              : old.data.unreadCount,
          },
        };
      },
    );

    remove.mutate(id);
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <PageWrapper
      title={t('notifications.title')}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => markAllRead.mutate()}
          loading={markAllRead.isPending}
          disabled={markAllRead.isPending}
        >
          {t('notifications.markAllRead')}
        </Button>
      }
    >
      {/* Filter tabs */}
      <div className="flex gap-1 self-start rounded-lg border border-border-default bg-bg-surface p-1">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-[150ms]',
              filter === f
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {f === 'all' ? t('notifications.all') : t('notifications.unread')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-hidden rounded-xl border border-border-default">
        {isLoading && (
          <div className="divide-y divide-border-subtle">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-4">
                <Skeleton variant="circle" width={16} height={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <Skeleton height={14} className="mb-2" />
                  <Skeleton height={12} width="60%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title={t('notifications.errorLoad')}
            message={t('common.error')}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <EmptyState
            title={filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')}
            {...(filter === 'unread' ? { description: t('notifications.emptyUnreadDescription') } : {})}
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            }
          />
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                {...(!notification.read ? { onMarkRead: () => optimisticMarkRead(notification.id) } : {})}
                onDelete={() => optimisticRemove(notification.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </PageWrapper>
  );
}
