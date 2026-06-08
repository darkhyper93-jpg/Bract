import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useUIStore, NotificationToast } from '../../stores/uiStore';

const variants = {
  success: 'border-success/30 bg-success/10',
  error: 'border-error/30 bg-error/10',
  warning: 'border-warning/30 bg-warning/10',
  info: 'border-info/30 bg-info/10',
  loading: 'border-border-default bg-bg-elevated',
} as const;

const iconColors = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-text-secondary',
} as const;

function ToastIcon({ type }: { type: NotificationToast['type'] }) {
  if (type === 'loading') {
    return (
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (type === 'success') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (type === 'warning') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ToastItem({ notification }: { notification: NotificationToast }) {
  const removeNotification = useUIStore((s) => s.removeNotification);
  const duration = notification.duration ?? 4000;

  useEffect(() => {
    if (notification.type === 'loading') return;
    const timer = setTimeout(() => removeNotification(notification.id), duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.type, duration, removeNotification]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3.5 shadow-lg shadow-black/20',
        'min-w-[280px] max-w-sm',
        variants[notification.type],
      )}
      role="alert"
    >
      <span className={cn('mt-0.5 shrink-0', iconColors[notification.type])}>
        <ToastIcon type={notification.type} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{notification.title}</p>
        {notification.message && (
          <p className="mt-0.5 text-xs text-text-secondary">{notification.message}</p>
        )}
      </div>
      {notification.type !== 'loading' && (
        <button
          onClick={() => removeNotification(notification.id)}
          className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Dismiss"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}

export function ToastContainer() {
  const notifications = useUIStore((s) => s.notifications);

  return createPortal(
    <div className="fixed bottom-4 right-4 flex flex-col gap-2" style={{ zIndex: 1100 }} aria-live="polite">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <ToastItem key={n.id} notification={n} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
