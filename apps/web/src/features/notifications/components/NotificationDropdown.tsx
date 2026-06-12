import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationActions } from '../hooks/useNotificationActions';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, isLoading, isError, refetch } = useNotifications({ page: 1, perPage: 5 });
  const { markAllRead } = useNotificationActions();

  function handleViewAll() {
    navigate('/notifications');
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-[380px] overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-2xl shadow-black/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-semibold text-text-primary">{t('notifications.title')}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
          loading={markAllRead.isPending}
        >
          {t('notifications.markAllRead')}
        </Button>
      </div>

      {/* Body */}
      <div className="max-h-[360px] overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col divide-y divide-border-subtle">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton variant="circle" width={16} height={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <Skeleton height={14} className="mb-1.5" />
                  <Skeleton height={12} width="70%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-text-secondary">{t('notifications.errorLoad')}</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              {t('notifications.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-text-secondary">{t('notifications.empty')}</p>
          </div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle px-4 py-2.5">
        <button
          onClick={handleViewAll}
          className="group w-full text-center text-sm text-brand-primary transition-colors duration-[150ms] hover:text-brand-hover"
        >
          {t('notifications.viewAll')}{' '}
          <span className="inline-block transition-transform duration-[150ms] group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </motion.div>
  );
}
