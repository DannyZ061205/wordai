import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/theme';
import { Tooltip } from './Tooltip';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useThemeStore();

  return (
    <Tooltip content={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      <button
        onClick={toggle}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className={`
          p-2 rounded-md transition-colors duration-150
          hover:bg-[color:var(--border)]
          text-[color:var(--text-secondary)]
          hover:text-[color:var(--text-primary)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]
          ${className ?? ''}
        `}
      >
        {theme === 'light' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        )}
      </button>
    </Tooltip>
  );
}
