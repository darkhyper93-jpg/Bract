import React from 'react';
import { cn } from '../../../utils/cn';
import { timeAgo } from '../../../utils/timeAgo';
import { Button } from '../../../components/ui/Button';
import { NotificationTypeIcon } from './NotificationTypeIcon';
import type { NotificationItem as NotificationItemType } from '@bract/shared';

interface NotificationItemProps {
  notification: NotificationItemType;
  onMarkRead?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  compact = false,
}: NotificationItemProps) {
  const { type, title, body, read, createdAt } = notification;

  return (
    <div
      className={cn(
        'flex gap-3 transition-colors duration-[150ms]',
        compact ? 'px-4 py-3' : 'px-4 py-4',
        read
          ? 'bg-transparent hover:bg-bg-overlay'
          : 'bg-bg-elevated hover:bg-bg-overlay',
        !read && 'border-l-2 border-brand-primary',
        read && 'border-l-2 border-transparent',
      )}
    >
      <div className="mt-0.5 shrink-0">
        <NotificationTypeIcon type={type} size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-snug',
              read ? 'font-normal text-text-primary' : 'font-semibold text-text-primary',
            )}
          >
            {title}
          </p>
          <span className="shrink-0 text-xs text-text-tertiary">{timeAgo(createdAt)}</span>
        </div>

        <p
          className={cn(
            'mt-0.5 text-sm text-text-secondary',
            compact && 'line-clamp-2',
          )}
        >
          {body}
        </p>

        {!compact && (
          <div className="mt-2 flex items-center gap-2">
            {!read && onMarkRead && (
              <Button variant="ghost" size="sm" onClick={onMarkRead}>
                Marcar como leída
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
