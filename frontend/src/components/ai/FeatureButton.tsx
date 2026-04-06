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
}

export function FeatureButton({
  icon,
  label,
  description,
  onClick,
  active = false,
  disabled = false,
  color = '#1a73e8',
}: FeatureButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-start gap-3 p-3 rounded-lg text-left',
        'transition-all duration-150 border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]',
        active
          ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a3a5c]'
          : 'border-[color:var(--border)] hover:border-[#1a73e8] hover:bg-[#e8f0fe]/50 dark:hover:bg-[#1a3a5c]/50',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
      aria-pressed={active}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
