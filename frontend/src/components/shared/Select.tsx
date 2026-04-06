import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (open && focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, open]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen((v) => !v);
    setFocusedIndex(options.findIndex((o) => o.value === value));
  };

  const handleSelect = (val: T) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && focusedIndex >= 0) {
          handleSelect(options[focusedIndex].value);
        } else {
          setOpen(true);
          setFocusedIndex(options.findIndex((o) => o.value === value));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { setOpen(true); setFocusedIndex(0); break; }
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) break;
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  const isSm = size === 'sm';

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={clsx(
          'flex items-center justify-between gap-2 w-full rounded-md border transition-all duration-150',
          'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 focus:border-[#1a73e8]',
          open ? 'border-[#1a73e8] ring-2 ring-[#1a73e8]/20' : 'border-[color:var(--border)]',
          disabled && 'opacity-50 cursor-not-allowed',
          isSm ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
        )}
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={clsx(
            'flex-shrink-0 transition-transform duration-150',
            open && 'rotate-180',
            isSm ? 'w-3 h-3' : 'w-4 h-4'
          )}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          id={id}
          role="listbox"
          className={clsx(
            'absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-y-auto',
            'bg-[color:var(--bg-surface)] border-[color:var(--border)]',
            'max-h-52 py-1',
            'animate-fade-in'
          )}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={clsx(
                  'flex items-center justify-between gap-2 cursor-pointer select-none transition-colors duration-75',
                  isSm ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                  isFocused
                    ? 'bg-[#1a73e8] text-white'
                    : isSelected
                    ? 'bg-[#e8f0fe] dark:bg-[#1a3a5c] text-[#1a73e8]'
                    : 'text-[color:var(--text-primary)] hover:bg-[color:var(--border)]'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check
                    className={clsx(
                      'flex-shrink-0',
                      isSm ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      isFocused ? 'text-white' : 'text-[#1a73e8]'
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
