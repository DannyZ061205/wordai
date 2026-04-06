import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Brain,
  Zap,
  Server,
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
import { settingsApi, ProviderPreset, AISettings, AISettingsUpdate } from '../../api/settings';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

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
  groq: {
    id: 'groq',
    icon: <Zap className="w-5 h-5" />,
    iconColor: '#f97316',
    tagline: 'Ultra-fast inference',
  },
  ollama: {
    id: 'ollama',
    icon: <Server className="w-5 h-5" />,
    iconColor: '#8b5cf6',
    tagline: 'Local models',
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
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    description: 'DeepSeek AI models',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    default_model: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'OpenAI GPT models',
  },
  {
    id: 'groq',
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    default_model: 'llama3-8b-8192',
    models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
    description: 'Groq ultra-fast inference',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    base_url: 'http://localhost:11434/v1',
    default_model: 'llama3',
    models: ['llama3', 'llama3:70b', 'mistral', 'codellama', 'phi3'],
    description: 'Local models via Ollama',
  },
  {
    id: 'custom',
    name: 'Custom',
    base_url: '',
    default_model: '',
    models: [],
    description: 'Any OpenAI-compatible endpoint',
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

// ── Test Result Banner ──────────────────────────────────────────────────────

interface TestResultProps {
  ok: boolean;
  message: string;
}

function TestResultBanner({ ok, message }: TestResultProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mt-2 animate-fade-in',
        ok
          ? 'bg-green-50 dark:bg-green-900/20 text-[#34a853]'
          : 'bg-red-50 dark:bg-red-900/20 text-[#d93025]'
      )}
      role="status"
    >
      {ok ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AISettingsModal({ isOpen, onClose, onSaved }: AISettingsModalProps) {
  const [providers, setProviders] = useState<ProviderPreset[]>(FALLBACK_PRESETS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const selectedPreset = providers.find((p) => p.id === selectedProviderId) ?? providers[0];

  // Determine the effective model value for submission
  const effectiveModel = model === '__custom__' ? customModel : model;

  // Reset test result whenever key inputs change
  const clearTestResult = useCallback(() => setTestResult(null), []);

  // When a provider is selected, auto-fill base_url and reset model
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      clearTestResult();
      const preset = providers.find((p) => p.id === providerId);
      if (preset) {
        setBaseUrl(preset.base_url);
        setModel(preset.default_model || (preset.models[0] ?? ''));
        setCustomModel('');
      }
    },
    [providers, clearTestResult]
  );

  // Load current settings and providers on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoadingInitial(true);
    setTestResult(null);
    setShowKey(false);

    Promise.all([settingsApi.getAI(), settingsApi.getProviders()])
      .then(([currentSettings, fetchedProviders]) => {
        if (cancelled) return;

        const presetsToUse =
          fetchedProviders && fetchedProviders.length > 0
            ? fetchedProviders
            : FALLBACK_PRESETS;
        setProviders(presetsToUse);

        if (currentSettings && currentSettings.is_configured) {
          // Pre-fill with current settings
          const providerId = currentSettings.provider || 'deepseek';
          setSelectedProviderId(providerId);
          setBaseUrl(currentSettings.base_url);

          // Show masked key as placeholder-style hint in the field
          // The actual input stays empty (user must re-enter to change)
          setApiKey('');

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
          // Defaults: first preset
          const defaultPreset = presetsToUse[0];
          setSelectedProviderId(defaultPreset.id);
          setBaseUrl(defaultPreset.base_url);
          setModel(defaultPreset.default_model || defaultPreset.models[0] || '');
          setApiKey('');
          setCustomModel('');
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to defaults with fallback presets
        const defaultPreset = FALLBACK_PRESETS[0];
        setProviders(FALLBACK_PRESETS);
        setSelectedProviderId(defaultPreset.id);
        setBaseUrl(defaultPreset.base_url);
        setModel(defaultPreset.default_model);
        setApiKey('');
        setCustomModel('');
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const buildPayload = (): AISettingsUpdate => ({
    provider: selectedProviderId,
    api_key: apiKey,
    base_url: baseUrl,
    model: effectiveModel,
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await settingsApi.testConnection(buildPayload());
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: 'Connection test failed. Check your settings.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveModel.trim() || !baseUrl.trim()) {
      toast.error('Model and Base URL are required');
      return;
    }

    setIsSaving(true);
    try {
      await settingsApi.updateAI(buildPayload());
      toast.success('AI settings saved');
      onSaved?.();
      onClose();
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = () => {
    setApiKey('');
    setShowKey(false);
    clearTestResult();
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    clearTestResult();
    if (value !== '__custom__') setCustomModel('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Configuration"
      size="xl"
    >
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
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    clearTestResult();
                  }}
                  placeholder={
                    selectedProviderId === 'ollama'
                      ? 'No API key required'
                      : 'Enter API key…'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className={clsx(
                    'w-full px-3 py-2.5 text-sm rounded-md pr-10',
                    'border transition-all duration-150 outline-none',
                    'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                    'placeholder:text-[color:var(--text-secondary)] placeholder:opacity-70',
                    'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20'
                  )}
                  disabled={selectedProviderId === 'ollama'}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  tabIndex={-1}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
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
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2.5 text-sm rounded-md',
                  'border transition-all duration-150 outline-none',
                  'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
                  'border-[color:var(--border)] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20',
                  'appearance-none cursor-pointer'
                )}
              >
                {selectedPreset.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">Custom model…</option>
              </select>
            ) : (
              // No preset models (custom provider)
              <input
                type="text"
                value={model === '__custom__' ? customModel : model}
                onChange={(e) => {
                  setModel(e.target.value);
                  clearTestResult();
                }}
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

            {/* Custom model text input when "Custom model…" is selected */}
            {model === '__custom__' && selectedPreset && selectedPreset.models.length > 0 && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value);
                  clearTestResult();
                }}
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

          {/* Base URL */}
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
              onChange={(e) => {
                setBaseUrl(e.target.value);
                clearTestResult();
              }}
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

          {/* Test connection result */}
          {testResult && (
            <TestResultBanner ok={testResult.ok} message={testResult.message} />
          )}

          {/* Action row */}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              loading={isTesting}
              icon={<Zap className="w-3.5 h-3.5" />}
            >
              Test Connection
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={isSaving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
