import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface FeatureButtonProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  color?: string;
  /**
   * When true, the component renders without its own border/background
   * (used as the "header" row inside a unified expanded card).
   */
  bare?: boolean;
}

export function FeatureButton({
  icon,
  label,
  description,
  onClick,
  active = false,
  disabled = false,
  color = '#1a73e8',
  bare = false,
}: FeatureButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-start gap-3 p-3 text-left rounded-lg',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/60',
        !bare && [
          'border',
          active
            ? 'border-[#1a73e8]/70 bg-[#e8f0fe]/60 dark:bg-[#1a3a5c]/40 shadow-sm'
            : [
                'border-[color:var(--border)] bg-[color:var(--bg-surface)]',
                'hover:border-[#1a73e8]/50 hover:bg-[#e8f0fe]/30 dark:hover:bg-[#1a3a5c]/20',
                'hover:shadow-sm',
              ],
        ],
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
      aria-pressed={active}
    >
      <div
        className={clsx(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white',
          'shadow-sm ring-1 ring-black/5 dark:ring-white/5',
        )}
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={clsx(
            'text-sm leading-tight',
            active ? 'font-semibold' : 'font-medium',
          )}
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </p>
        {description && (
          <p
            className="text-xs mt-1 leading-snug line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
