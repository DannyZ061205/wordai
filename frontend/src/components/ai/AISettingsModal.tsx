import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Brain,
  Zap,
  Bot,
  Settings,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Select } from '../shared/Select';
import { settingsApi, ProviderPreset, AISettingsUpdate } from '../../api/settings';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the user successfully saves a key. */
  onSaved?: () => void;
  /** Called after the user successfully clears their saved key. */
  onCleared?: () => void;
}

type KeyStatus = 'idle' | 'testing' | 'ok' | 'error';

// ── Provider card metadata ──────────────────────────────────────────────────

interface ProviderMeta {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  tagline: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  deepseek: {
    id: 'deepseek',
    icon: <Sparkles className="w-5 h-5" />,
    iconColor: '#1a73e8',
    tagline: 'Fast & affordable',
  },
  openai: {
    id: 'openai',
    icon: <Brain className="w-5 h-5" />,
    iconColor: '#10a37f',
    tagline: 'GPT-4 & beyond',
  },
  grok: {
    id: 'grok',
    icon: <Zap className="w-5 h-5" />,
    iconColor: '#a855f7',
    tagline: 'xAI frontier model',
  },
  claude: {
    id: 'claude',
    icon: <Bot className="w-5 h-5" />,
    iconColor: '#c96442',
    tagline: 'Thoughtful & powerful',
  },
  custom: {
    id: 'custom',
    icon: <Settings className="w-5 h-5" />,
    iconColor: '#6b7280',
    tagline: 'Any endpoint',
  },
};

// Fallback presets so the modal is usable even if the API call fails
const FALLBACK_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com',
    default_model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'Fast, cost-effective Chinese LLM with strong coding/reasoning',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    default_model: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    description: 'Industry-leading models from OpenAI',
  },
  {
    id: 'grok',
    name: 'Grok',
    base_url: 'https://api.x.ai/v1',
    default_model: 'grok-4',
    models: ['grok-4', 'grok-3', 'grok-3-mini'],
    description: "xAI's Grok — frontier reasoning model by Elon Musk's xAI",
  },
  {
    id: 'claude',
    name: 'Claude',
    base_url: 'https://api.anthropic.com',
    default_model: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    description: "Anthropic's Claude — thoughtful, safe, and powerful",
  },
  {
    id: 'custom',
    name: 'Custom',
    base_url: '',
    default_model: '',
    models: [],
    description: 'Any OpenAI-compatible endpoint (LM Studio, Azure, vLLM, etc.)',
  },
];

// ── Provider Card ───────────────────────────────────────────────────────────

interface ProviderCardProps {
  preset: ProviderPreset;
  selected: boolean;
  onClick: () => void;
}

function ProviderCard({ preset, selected, onClick }: ProviderCardProps) {
  const meta = PROVIDER_META[preset.id] ?? {
    id: preset.id,
    icon: <Settings className="w-5 h-5" />,
    iconColor: '#6b7280',
    tagline: preset.description,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-1',
        'hover:border-[#1a73e8]/50 cursor-pointer w-full',
        selected
          ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a3a5c]'
          : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-app)]'
      )}
      aria-pressed={selected}
      aria-label={`Select ${preset.name} provider`}
    >
      <span style={{ color: selected ? meta.iconColor : 'var(--text-secondary)' }}>
        {meta.icon}
      </span>
      <span
        className="text-xs font-semibold leading-none"
        style={{ color: selected ? '#1a73e8' : 'var(--text-primary)' }}
      >
        {preset.name}
      </span>
      <span
        className="text-[10px] leading-tight text-center"
        style={{ color: 'var(--text-secondary)' }}
      >
        {meta.tagline}
      </span>
    </button>
  );
}

// ── Key status indicator ────────────────────────────────────────────────────

function KeyStatusIndicator({ status, message }: { status: KeyStatus; message: string }) {
  if (status === 'idle') return null;

  if (status === 'testing') {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Verifying API key…</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 mt-1.5 text-xs',
        status === 'ok' ? 'text-[#34a853]' : 'text-[#d93025]'
      )}
    >
      {status === 'ok' ? (
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AISettingsModal({ isOpen, onClose, onSaved, onCleared }: AISettingsModalProps) {
  const [providers, setProviders] = useState<ProviderPreset[]>(FALLBACK_PRESETS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [keyStatusMessage, setKeyStatusMessage] = useState('');
  const [initialConfigured, setInitialConfigured] = useState(false);
  const [initialProviderId, setInitialProviderId] = useState<string>('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always have latest values in the async debounce callback
  const latestRef = useRef({ baseUrl, effectiveModel: '', selectedProviderId });

  const selectedPreset = providers.find((p) => p.id === selectedProviderId) ?? providers[0];
  const effectiveModel = model === '__custom__' ? customModel : model;
  const isClaudeProvider = selectedProviderId === 'claude';
  const STORED_KEY_MASK = '•'.repeat(32);

  // Keep latest values accessible to the debounce callback without re-running the effect
  useEffect(() => {
    latestRef.current = { baseUrl, effectiveModel, selectedProviderId };
  }, [baseUrl, effectiveModel, selectedProviderId]);

  // Can save if:
  //   (a) user left the key blank and a key was already saved → keep existing key
  //   (b) user typed a new key and it passed the connection test
  const canSave = (apiKey.trim() === '' && initialConfigured) || keyStatus === 'ok';

  // Auto-test API key — triggers 1.5 s after user stops typing, or on provider change
  useEffect(() => {
    if (!apiKey.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setKeyStatus('idle');
      setKeyStatusMessage('');
      return;
    }

    // Show "testing" immediately, then wait for debounce
    setKeyStatus('testing');
    setKeyStatusMessage('');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const { baseUrl: curBaseUrl, effectiveModel: curModel, selectedProviderId: curProvider } =
        latestRef.current;
      try {
        const result = await settingsApi.testConnection({
          provider: curProvider,
          api_key: apiKey,
          base_url: curBaseUrl,
          model: curModel,
        });
        setKeyStatus(result.ok ? 'ok' : 'error');
        setKeyStatusMessage(result.message);
      } catch {
        setKeyStatus('error');
        setKeyStatusMessage('Connection test failed. Check your settings.');
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [apiKey, selectedProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a provider is selected, auto-fill base_url and reset model
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      const preset = providers.find((p) => p.id === providerId);
      if (preset) {
        setBaseUrl(preset.base_url);
        setModel(preset.default_model || (preset.models[0] ?? ''));
        setCustomModel('');
      }
      // When switching to a different provider the stored key doesn't apply
      if (providerId !== initialProviderId) {
        setApiKey('');
        setInitialConfigured(false);
        setKeyStatus('idle');
        setKeyStatusMessage('');
      } else {
        // Back to the originally configured provider — restore saved-key state
        setApiKey('');
        setInitialConfigured(true);
        setKeyStatus('ok');
        setKeyStatusMessage('API key is configured');
      }
    },
    [providers, initialProviderId]
  );

  // Load current settings and providers on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoadingInitial(true);
    setKeyStatus('idle');
    setKeyStatusMessage('');
    setShowKey(false);
    setInitialConfigured(false);

    Promise.all([settingsApi.getAI(), settingsApi.getProviders()])
      .then(([currentSettings, fetchedProviders]) => {
        if (cancelled) return;

        const presetsToUse =
          fetchedProviders && fetchedProviders.length > 0 ? fetchedProviders : FALLBACK_PRESETS;
        setProviders(presetsToUse);

        if (currentSettings && currentSettings.is_configured) {
          const providerId = currentSettings.provider || 'deepseek';
          setSelectedProviderId(providerId);
          setInitialProviderId(providerId);
          setBaseUrl(currentSettings.base_url);
          setApiKey(''); // key stays blank; user re-enters to change it
          setInitialConfigured(true);
          setKeyStatus('ok'); // treat saved key as already validated
          setKeyStatusMessage('API key is configured');

          const presetForProvider = presetsToUse.find((p) => p.id === providerId);
          const savedModel = currentSettings.model;
          if (
            presetForProvider &&
            presetForProvider.models.length > 0 &&
            !presetForProvider.models.includes(savedModel) &&
            savedModel
          ) {
            setModel('__custom__');
            setCustomModel(savedModel);
          } else {
            setModel(savedModel || presetForProvider?.default_model || '');
            setCustomModel('');
          }
        } else {
          const defaultPreset = presetsToUse[0];
          setSelectedProviderId(defaultPreset.id);
          setBaseUrl(defaultPreset.base_url);
          setModel(defaultPreset.default_model || defaultPreset.models[0] || '');
          setApiKey('');
          setCustomModel('');
          setInitialConfigured(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const defaultPreset = FALLBACK_PRESETS[0];
        setProviders(FALLBACK_PRESETS);
        setSelectedProviderId(defaultPreset.id);
        setBaseUrl(defaultPreset.base_url);
        setModel(defaultPreset.default_model);
        setApiKey('');
        setCustomModel('');
        setInitialConfigured(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (!effectiveModel.trim()) {
      toast.error('Model is required');
      return;
    }
    if (!isClaudeProvider && !baseUrl.trim()) {
      toast.error('Base URL is required');
      return;
    }

    // Only show the spinner if the request takes longer than 200 ms,
    // preventing a jarring flash on fast (local) responses.
    const loadingTimer = setTimeout(() => setIsSaving(true), 200);
    try {
      await settingsApi.updateAI({
        provider: selectedProviderId,
        api_key: apiKey.trim(), // empty string = keep existing key (backend handles it)
        base_url: isClaudeProvider ? 'https://api.anthropic.com' : baseUrl,
        model: effectiveModel,
      });
      toast.success('AI settings saved');
      onSaved?.();
      onClose();
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      clearTimeout(loadingTimer);
      setIsSaving(false);
    }
  };

  const handleClearKey = async () => {
    // Case 1: user is typing a new key but hasn't saved → just clear the input.
    if (!initialConfigured) {
      setApiKey('');
      setShowKey(false);
      setKeyStatus('idle');
      setKeyStatusMessage('');
      return;
    }

    // Case 2: there IS a saved key on the backend → delete it for real.
    try {
      await settingsApi.deleteAI();
      setApiKey('');
      setShowKey(false);
      setKeyStatus('idle');
      setKeyStatusMessage('');
      setInitialConfigured(false);
      setInitialProviderId('');
      toast.success('API key cleared');
      // Notify the parent so the setup banner reappears immediately.
      onCleared?.();
    } catch {
      toast.error('Failed to clear API key');
    }
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    if (value !== '__custom__') setCustomModel('');
  };

  // Compute border color for the API key input based on keyStatus
  const keyBorderClass = (() => {
    if (keyStatus === 'ok') return 'border-[#34a853] focus:border-[#34a853] focus:ring-[#34a853]/20';
    if (keyStatus === 'error') return 'border-[#d93025] focus:border-[#d93025] focus:ring-[#d93025]/20';
    return 'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-[#1a73e8]/20';
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Configuration" size="xl">
      {loadingInitial ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#1a73e8]" />
          <span className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading settings…
          </span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Provider grid */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
              Choose your AI provider
            </p>
            <div className="grid grid-cols-5 gap-2">
              {providers.map((preset) => (
                <ProviderCard
                  key={preset.id}
                  preset={preset}
                  selected={selectedProviderId === preset.id}
                  onClick={() => handleProviderSelect(preset.id)}
                />
              ))}
            </div>
            {selectedPreset?.description && (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {selectedPreset.description}
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey && apiKey !== '' ? 'text' : 'password'}
                  value={initialConfigured && apiKey === '' ? STORED_KEY_MASK : apiKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Ignore if user somehow types the exact mask string
                    if (v === STORED_KEY_MASK) return;
                    setApiKey(v);
                  }}
                  onFocus={() => {
                    // Clear the mask so the user can type a new key
                    if (initialConfigured && apiKey === '') setApiKey('');
                  }}
                  placeholder="Paste your API key…"
                  autoComplete="off"
                  spellCheck={false}
                  className={clsx(
                    'w-full px-3 py-2.5 text-sm rounded-md pr-10',
                    'border-2 transition-all duration-150 outline-none',
                    'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                    'placeholder:text-[color:var(--text-secondary)] placeholder:opacity-70',
                    'focus:ring-2',
                    keyBorderClass
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleClearKey}
                className={clsx(
                  'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium',
                  'border border-[color:var(--border)]',
                  'bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)]',
                  'hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]',
                  'transition-colors'
                )}
                aria-label="Clear API key"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
            <KeyStatusIndicator status={keyStatus} message={keyStatusMessage} />
          </div>

          {/* Model selector */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              Model
            </label>
            {selectedPreset && selectedPreset.models.length > 0 ? (
              <Select
                value={model}
                onChange={handleModelChange}
                options={[
                  ...selectedPreset.models.map((m) => ({ label: m, value: m })),
                  { label: 'Custom model…', value: '__custom__' },
                ]}
              />
            ) : (
              <input
                type="text"
                value={model === '__custom__' ? customModel : model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4o-mini"
                className={clsx(
                  'w-full px-3 py-2.5 text-sm rounded-md',
                  'border transition-all duration-150 outline-none',
                  'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                  'placeholder:text-[color:var(--text-secondary)] placeholder:opacity-70',
                  'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20'
                )}
              />
            )}

            {model === '__custom__' && selectedPreset && selectedPreset.models.length > 0 && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Type model name…"
                className={clsx(
                  'w-full mt-2 px-3 py-2.5 text-sm rounded-md',
                  'border transition-all duration-150 outline-none',
                  'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                  'placeholder:text-[color:var(--text-secondary)] placeholder:opacity-70',
                  'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20'
                )}
                autoFocus
              />
            )}
          </div>

          {/* Base URL — hidden for Claude (uses Anthropic SDK internally) */}
          {!isClaudeProvider && (
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Base URL
                <span
                  className="ml-1.5 text-xs font-normal"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  (auto-filled, editable)
                </span>
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className={clsx(
                  'w-full px-3 py-2.5 text-sm rounded-md',
                  'border transition-all duration-150 outline-none',
                  'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                  'placeholder:text-[color:var(--text-secondary)] placeholder:opacity-70',
                  'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20',
                  'font-mono text-xs'
                )}
              />
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              loading={isSaving}
              disabled={!canSave || isSaving}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
