import {
  ReactNode,
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  createContext,
  useContext,
} from 'react';
import { clsx } from 'clsx';

interface DropdownContextValue {
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue>({ close: () => {} });

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, children, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape as unknown as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape as unknown as EventListener);
    };
  }, []);

  return (
    <DropdownContext.Provider value={{ close }}>
      <div ref={containerRef} className={clsx('relative inline-block', className)}>
        <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
        {open && (
          <div
            className={clsx(
              'absolute z-40 mt-1 min-w-[160px] rounded-lg shadow-lg overflow-hidden',
              'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
              'animate-fade-in',
              align === 'right' ? 'right-0' : 'left-0'
            )}
            role="menu"
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  children,
  onClick,
  icon,
  danger = false,
  disabled = false,
  className,
}: DropdownItemProps) {
  const { close } = useContext(DropdownContext);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      role="menuitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left',
        'transition-colors duration-100',
        danger
          ? 'text-[#d93025] hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-[color:var(--text-primary)] hover:bg-[color:var(--border)]',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {icon && (
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="border-t border-[color:var(--border)] my-1" />;
}
