import { Collaborator } from '../../types';
import { Avatar } from '../shared/Avatar';
import { Tooltip } from '../shared/Tooltip';

interface PresenceBarProps {
  collaborators: Collaborator[];
  maxVisible?: number;
}

export function PresenceBar({ collaborators, maxVisible = 5 }: PresenceBarProps) {
  if (collaborators.length === 0) return null;

  const visible = collaborators.slice(0, maxVisible);
  const overflow = collaborators.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2" aria-label="Active collaborators">
      {visible.map((collab) => (
        <Tooltip key={collab.user_id} content={collab.username}>
          <div className="relative">
            <Avatar
              name={collab.username}
              color={collab.color}
              size="sm"
              className="ring-2 ring-white dark:ring-[#2d2d2d] cursor-default"
            />
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34a853] rounded-full ring-2 ring-white dark:ring-[#2d2d2d]" />
          </div>
        </Tooltip>
      ))}

      {overflow > 0 && (
        <Tooltip content={`${overflow} more collaborator${overflow > 1 ? 's' : ''}`}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                        bg-[color:var(--border)] text-[color:var(--text-secondary)]
                        ring-2 ring-white dark:ring-[#2d2d2d] cursor-default"
          >
            +{overflow}
          </div>
        </Tooltip>
      )}
    </div>
  );
}
