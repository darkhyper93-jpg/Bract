import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import type { SelectOption } from './Select';

export interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  // Atajo "seleccionar todo" (p. ej. "Toda la materia"). Si se omite, no se muestra la fila.
  selectAllLabel?: string;
  className?: string;
  id?: string;
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-[150ms]',
        checked ? 'border-brand-primary bg-brand-primary text-bg-base' : 'border-border-default',
      )}
    >
      {checked && (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

// Multi-select con dropdown (mismo lenguaje visual que Select): cada opción es un checkbox que se
// togglea sin cerrar el panel; fila opcional "seleccionar todo". El botón resume las etiquetas elegidas.
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options',
  label,
  error,
  disabled = false,
  selectAllLabel,
  className,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const enabledValues = options.filter((o) => !o.disabled).map((o) => o.value);
  const allSelected = enabledValues.length > 0 && enabledValues.every((v) => value.includes(v));
  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);

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

  const toggle = (optValue: string) => {
    onChange(value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue]);
  };

  const toggleAll = () => onChange(allSelected ? [] : enabledValues);

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
            'flex w-full items-center justify-between gap-2 rounded-lg bg-bg-surface',
            'border border-border-default min-h-9 px-3 py-1.5 text-sm',
            'transition-colors duration-[150ms]',
            'focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30',
            open && 'border-brand-primary ring-1 ring-brand-primary/30',
            error && 'border-error focus:border-error focus:ring-error/30',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className={cn('truncate text-left', selectedLabels.length > 0 ? 'text-text-primary' : 'text-text-tertiary')}>
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
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
              aria-multiselectable="true"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute z-dropdown left-0 right-0 mt-1 rounded-lg border border-border-subtle bg-bg-elevated shadow-xl shadow-black/30 py-1 max-h-60 overflow-auto"
            >
              {selectAllLabel && enabledValues.length > 0 && (
                <li
                  role="option"
                  aria-selected={allSelected}
                  onClick={toggleAll}
                  className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm cursor-pointer text-text-secondary transition-colors duration-[150ms] hover:text-text-primary hover:bg-bg-overlay"
                >
                  <CheckBox checked={allSelected} />
                  {selectAllLabel}
                </li>
              )}
              {options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={checked}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && toggle(opt.value)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors duration-[150ms]',
                      checked ? 'text-brand-primary bg-brand-muted' : 'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
                      opt.disabled && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <CheckBox checked={checked} />
                    {opt.label}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
