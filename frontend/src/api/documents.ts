import api from './axios';
import { Document, DocumentListItem, Version, Share, ShareLink } from '../types';

interface CreateDocumentData {
  title: string;
}

interface UpdateDocumentData {
  title?: string;
  content?: string;
}

export const documentsApi = {
  async list(): Promise<DocumentListItem[]> {
    const response = await api.get<DocumentListItem[]>('/documents/');
    return response.data;
  },

  async create(title: string): Promise<Document> {
    const response = await api.post<Document>('/documents/', { title });
    return response.data;
  },

  async get(id: string): Promise<Document> {
    const response = await api.get<Document>(`/documents/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateDocumentData): Promise<Document> {
    const response = await api.patch<Document>(`/documents/${id}`, data);
    return response.data;
  },

  async updateViaLink(
    id: string,
    shareToken: string,
    data: UpdateDocumentData
  ): Promise<Document & { role: string }> {
    const response = await api.patch<Document & { role: string }>(`/documents/${id}`, data, {
      params: { share_token: shareToken },
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },

  async getVersions(id: string): Promise<Version[]> {
    const response = await api.get<Version[]>(`/documents/${id}/versions`);
    return response.data;
  },

  async restoreVersion(docId: string, versionId: string): Promise<Document> {
    const response = await api.post<Document>(
      `/documents/${docId}/versions/${versionId}/restore`
    );
    return response.data;
  },

  async getShares(id: string): Promise<Share[]> {
    const response = await api.get<Share[]>(`/documents/${id}/shares`);
    return response.data;
  },

  async addShare(
    id: string,
    user_identifier: string,
    role: 'editor' | 'viewer'
  ): Promise<Share> {
    const response = await api.post<Share>(`/documents/${id}/shares`, {
      user_identifier,
      role,
    });
    return response.data;
  },

  async removeShare(id: string, userId: string): Promise<void> {
    await api.delete(`/documents/${id}/shares/${userId}`);
  },

  async updateShareRole(
    id: string,
    userId: string,
    role: 'editor' | 'viewer'
  ): Promise<Share> {
    const response = await api.patch<Share>(`/documents/${id}/shares/${userId}`, {
      role,
    });
    return response.data;
  },

  async createShareLink(
    id: string,
    role: 'editor' | 'viewer',
    expires_in_days?: number
  ): Promise<ShareLink> {
    const response = await api.post<ShareLink>(`/documents/${id}/share-links`, {
      role,
      expires_in_days,
    });
    return response.data;
  },

  async getShareLinks(id: string): Promise<ShareLink[]> {
    const response = await api.get<ShareLink[]>(`/documents/${id}/share-links`);
    return response.data;
  },

  async revokeShareLink(id: string, token: string): Promise<void> {
    await api.delete(`/documents/${id}/share-links/${token}`);
  },

  async getViaLink(token: string): Promise<Document & { role: string }> {
    const response = await api.get<Document & { role: string }>(
      `/documents/via-link/${token}`
    );
    return response.data;
  },
};

// Re-export for convenience
export type { CreateDocumentData, UpdateDocumentData };
