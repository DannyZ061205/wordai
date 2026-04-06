import api from './axios';

export interface ProviderPreset {
  id: string;          // "deepseek" | "openai" | "groq" | "ollama" | "custom"
  name: string;
  base_url: string;
  default_model: string;
  models: string[];
  description: string;
}

export interface AISettings {
  provider: string;
  api_key_masked: string;   // e.g. "sk-****cd8c2"
  base_url: string;
  model: string;
  is_configured: boolean;
}

export interface AISettingsUpdate {
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
}

export const settingsApi = {
  getAI: (): Promise<AISettings | null> =>
    api.get('/settings/ai').then(r => r.data).catch(() => null),

  updateAI: (data: AISettingsUpdate): Promise<AISettings> =>
    api.put('/settings/ai', data).then(r => r.data),

  deleteAI: (): Promise<void> =>
    api.delete('/settings/ai').then(() => undefined),

  getProviders: (): Promise<ProviderPreset[]> =>
    api.get('/settings/ai/providers').then(r => r.data),

  testConnection: (data: AISettingsUpdate): Promise<{ ok: boolean; message: string }> =>
    api.post('/settings/ai/test', data).then(r => r.data),
};
