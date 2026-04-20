import { useState, useEffect, useRef } from 'react';
import { X, Zap, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { settingsApi } from '../../api/settings';

const BANNER_DISMISSED_KEY = 'ai_banner_dismissed';

interface AISetupBannerProps {
  onConfigureClick: () => void;
  /**
   * External signal that the user has just configured AI (e.g. returned
   * from the settings modal after saving). When true, the banner hides
   * immediately without waiting for a fresh fetch.
   */
  configured?: boolean;
}

/**
 * Informational banner urging first-time users to configure an AI provider.
 *
 * Hides itself automatically once the user has saved their own API key in
 * Settings. There is no system-wide fallback — every user must configure
 * their own provider — so visibility reduces to a single check: is the
 * user configured?
 */
export function AISetupBanner({ onConfigureClick, configured = false }: AISetupBannerProps) {
  const [visible, setVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const mountedRef = useRef(false);

  // Decide whether to show the banner by asking the backend whether AI is
  // actually available (per-user key OR system fallback).
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    settingsApi
      .getAI()
      .then((s) => {
        if (cancelled) return;
        const aiAvailable = Boolean(s?.is_configured);
        setShouldShow(!aiAvailable);
      })
      .catch(() => {
        // If we can't reach the settings endpoint, fall back to showing the
        // banner — that's the safer "nudge the user" default.
        if (!cancelled) setShouldShow(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  // Slide-in animation once we know we should show the banner
  useEffect(() => {
    if (dismissed || !shouldShow) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setVisible(true);
    }, 50);
    mountedRef.current = true;
    return () => clearTimeout(timer);
  }, [dismissed, shouldShow]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setDismissed(true);
      try {
        localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
      } catch {
        // localStorage unavailable – ignore
      }
    }, 300);
  };

  if (dismissed || configured || !shouldShow) return null;

  return (
    <div
      className={clsx(
        'w-full overflow-hidden transition-all duration-300 ease-in-out',
        visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
      )}
      role="alert"
      aria-live="polite"
    >
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-2.5',
          'bg-amber-50 dark:bg-amber-900/20',
          'border-b border-amber-200 dark:border-amber-700/50'
        )}
      >
        {/* Icon */}
        <Zap
          className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />

        {/* Message */}
        <span className="text-sm flex-1 text-amber-800 dark:text-amber-300">
          AI features need an API key to work.
        </span>

        {/* CTA */}
        <button
          type="button"
          onClick={onConfigureClick}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium',
            'bg-amber-600 hover:bg-amber-700 text-white',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1'
          )}
          aria-label="Configure AI settings"
        >
          Configure AI
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className={clsx(
            'p-1 rounded-md flex-shrink-0',
            'text-amber-600 dark:text-amber-400',
            'hover:bg-amber-100 dark:hover:bg-amber-800/40',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1'
          )}
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
