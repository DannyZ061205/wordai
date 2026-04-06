import { createContext, useContext, ReactNode, useState } from 'react';
import { Editor } from '@tiptap/core';

interface EditorContextValue {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}

const EditorContext = createContext<EditorContextValue>({
  editor: null,
  setEditor: () => {},
});

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <EditorContext.Provider value={{ editor, setEditor }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext);
}
