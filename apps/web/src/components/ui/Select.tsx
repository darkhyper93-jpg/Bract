import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled = false,
  className,
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center justify-between rounded-lg bg-bg-surface',
            'border border-border-default h-9 px-3 text-sm',
            'transition-colors duration-[150ms]',
            'focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30',
            open && 'border-brand-primary ring-1 ring-brand-primary/30',
            error && 'border-error focus:border-error focus:ring-error/30',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className={selectedOption ? 'text-text-primary' : 'text-text-tertiary'}>
            {selectedOption?.label ?? placeholder}
          </span>
          <svg
            className={cn('h-4 w-4 text-text-tertiary shrink-0 transition-transform duration-[150ms]', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute z-dropdown left-0 right-0 mt-1 rounded-lg border border-border-subtle bg-bg-elevated shadow-xl shadow-black/30 py-1 max-h-60 overflow-auto"
            >
              {options.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange?.(opt.value);
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer transition-colors duration-[150ms]',
                    opt.value === value
                      ? 'text-brand-primary bg-brand-muted'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
                    opt.disabled && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {opt.label}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
