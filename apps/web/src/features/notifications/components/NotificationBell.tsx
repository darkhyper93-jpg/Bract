import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { count } = useUnreadCount();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificaciones${count > 0 ? ` (${count} sin leer)` : ''}`}
        className={cn(
          'relative rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms]',
          'hover:bg-bg-elevated hover:text-text-primary',
          open && 'bg-bg-elevated text-text-primary',
        )}
      >
        <svg
          className="h-4 w-4"
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

        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-error/60" />
            <span
              className={cn(
                'relative flex items-center justify-center',
                'rounded-full bg-error text-[10px] font-bold text-white',
                count <= 9 ? 'h-[18px] w-[18px]' : 'h-[18px] min-w-[18px] px-1',
              )}
            >
              {count > 99 ? '99+' : count}
            </span>
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-dropdown mt-2">
            <NotificationDropdown onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
