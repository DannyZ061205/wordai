export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role: string;
}

export interface Version {
  id: string;
  doc_id: string;
  version_number: number;
  content: string;
  created_at: string;
}

export interface Share {
  id: string;
  doc_id: string;
  user_id: string;
  username: string;
  email: string;
  role: 'editor' | 'viewer';
}

export interface ShareLink {
  token: string;
  doc_id: string;
  role: 'editor' | 'viewer';
  expires_at: string | null;
  created_at: string;
}

export type AIFeature =
  | 'rewrite'
  | 'summarize'
  | 'translate'
  | 'expand'
  | 'grammar'
  | 'custom'
  | 'autocomplete';

export interface AIRequest {
  feature: AIFeature;
  selected_text: string;
  context_before?: string;
  context_after?: string;
  options?: Record<string, unknown>;
}

export interface AIInteraction {
  id: string;
  doc_id: string;
  feature: AIFeature;
  input_text: string;
  response_text: string;
  accepted: boolean | null;
  created_at: string;
}

export interface Collaborator {
  user_id: string;
  username: string;
  color: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';
