import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function generateColor(name: string): string {
  const colors = [
    '#1a73e8', '#34a853', '#ea4335', '#fbbc04',
    '#4285f4', '#0f9d58', '#db4437', '#f4b400',
    '#7c4dff', '#00bcd4', '#ff5722', '#9c27b0',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  const bgColor = color ?? generateColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold text-white',
        'flex-shrink-0 select-none ring-2 ring-white dark:ring-[#2d2d2d]',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bgColor }}
      title={name}
      aria-label={`Avatar for ${name}`}
    >
      {initials}
    </div>
  );
}
