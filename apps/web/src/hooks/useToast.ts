import { useCallback } from 'react';
import { useUIStore, type NotificationToast } from '../stores/uiStore';

let idCounter = 0;

function genId() {
  return `toast-${++idCounter}-${Date.now()}`;
}

export function useToast() {
  const addNotification = useUIStore((s) => s.addNotification);
  const removeNotification = useUIStore((s) => s.removeNotification);

  const toast = useCallback(
    (opts: Omit<NotificationToast, 'id'>) => {
      const id = genId();
      addNotification({ id, ...opts });
      return id;
    },
    [addNotification],
  );

  const dismiss = useCallback(
    (id: string) => removeNotification(id),
    [removeNotification],
  );

  return {
    toast,
    dismiss,
    success: (title: string, message?: string, duration?: number) =>
      toast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      toast({ type: 'error', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
      toast({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      toast({ type: 'info', title, message, duration }),
    loading: (title: string, message?: string) =>
      toast({ type: 'loading', title, message }),
  };
}
