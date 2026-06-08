import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  separator?: never;
}

export interface DropdownSeparator {
  key: string;
  separator: true;
  label?: never;
  onClick?: never;
  disabled?: never;
  danger?: never;
}

export type DropdownMenuItem = DropdownItem | DropdownSeparator;

export interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  const focusableItems = items.filter((i): i is DropdownItem => !('separator' in i) && !i.disabled);

  const updateCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: align === 'right' ? rect.right : rect.left,
      width: rect.width,
    });
  }, [align]);

  const openMenu = useCallback(() => {
    updateCoords();
    setOpen(true);
    setFocusIndex(-1);
  }, [updateCoords]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, focusableItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault();
        focusableItems[focusIndex]?.onClick?.();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, focusIndex, focusableItems]);

  return (
    <>
      {React.cloneElement(trigger, {
        ref: triggerRef,
        onClick: (e: React.MouseEvent) => {
          trigger.props.onClick?.(e);
          open ? setOpen(false) : openMenu();
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: coords.top,
                ...(align === 'right'
                  ? { right: window.innerWidth - coords.left }
                  : { left: coords.left }),
                zIndex: 500,
                minWidth: Math.max(coords.width, 160),
              }}
              className={cn(
                'rounded-lg border border-border-subtle bg-bg-elevated',
                'shadow-xl shadow-black/30 py-1',
                className,
              )}
            >
              {items.map((item) => {
                if ('separator' in item) {
                  return <div key={item.key} className="my-1 border-t border-border-subtle" role="separator" />;
                }
                const focusableIdx = focusableItems.indexOf(item);
                return (
                  <button
                    key={item.key}
                    role="menuitem"
                    disabled={item.disabled}
                    tabIndex={focusIndex === focusableIdx ? 0 : -1}
                    onClick={() => { item.onClick?.(); setOpen(false); }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left',
                      'transition-colors duration-[150ms]',
                      item.danger
                        ? 'text-error hover:bg-error/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
                      item.disabled && 'opacity-40 cursor-not-allowed',
                      focusIndex === focusableIdx && 'bg-bg-overlay',
                    )}
                  >
                    {item.icon && <span className="shrink-0 text-[1em]">{item.icon}</span>}
                    {item.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
