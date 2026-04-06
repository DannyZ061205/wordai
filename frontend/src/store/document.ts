import { create } from 'zustand';
import { Document, DocumentListItem, SaveStatus } from '../types';
import { documentsApi } from '../api/documents';

interface DocumentStore {
  documents: DocumentListItem[];
  currentDoc: Document | null;
  saveStatus: SaveStatus;
  isLoadingDocuments: boolean;
  fetchDocuments: () => Promise<void>;
  setCurrentDoc: (doc: Document) => void;
  setSaveStatus: (status: SaveStatus) => void;
  updateDocumentTitle: (id: string, title: string) => void;
  removeDocument: (id: string) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  currentDoc: null,
  saveStatus: 'saved',
  isLoadingDocuments: false,

  fetchDocuments: async () => {
    set({ isLoadingDocuments: true });
    try {
      const docs = await documentsApi.list();
      set({ documents: docs });
    } finally {
      set({ isLoadingDocuments: false });
    }
  },

  setCurrentDoc: (doc: Document) => {
    set({ currentDoc: doc, saveStatus: 'saved' });
  },

  setSaveStatus: (status: SaveStatus) => {
    set({ saveStatus: status });
  },

  updateDocumentTitle: (id: string, title: string) => {
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, title } : doc
      ),
      currentDoc:
        state.currentDoc?.id === id
          ? { ...state.currentDoc, title }
          : state.currentDoc,
    }));
  },

  removeDocument: (id: string) => {
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
    }));
  },
}));
