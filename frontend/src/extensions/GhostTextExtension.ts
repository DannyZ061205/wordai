import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface GhostState {
  text: string;
  isPredicting: boolean;
}

export const ghostTextPluginKey = new PluginKey<GhostState>('ghostText');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ghostText: {
      setGhostText: (text: string, isPredicting?: boolean) => ReturnType;
      clearGhostText: () => ReturnType;
      acceptGhostText: () => ReturnType;
    };
  }
}

export const GhostTextExtension = Extension.create({
  name: 'ghostText',

  addCommands() {
    return {
      setGhostText:
        (text: string, isPredicting = false) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(ghostTextPluginKey, { text, isPredicting });
            dispatch(tr);
          }
          return true;
        },

      clearGhostText:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(ghostTextPluginKey, { text: '', isPredicting: false });
            dispatch(tr);
          }
          return true;
        },

      acceptGhostText:
        () =>
        ({ tr, dispatch, state }) => {
          const ghost = ghostTextPluginKey.getState(state);
          if (!ghost?.text) return false;
          if (dispatch) {
            // Insert text at cursor; tr.docChanged = true will auto-clear ghost state
            tr.insertText(ghost.text, state.selection.$head.pos);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Tab accepts the suggestion
      Tab: ({ editor }) => {
        const ghost = ghostTextPluginKey.getState(editor.state);
        if (!ghost?.text) return false;
        return editor.commands.acceptGhostText();
      },
      // Escape dismisses it
      Escape: ({ editor }) => {
        const ghost = ghostTextPluginKey.getState(editor.state);
        if (!ghost?.text && !ghost?.isPredicting) return false;
        return editor.commands.clearGhostText();
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ghostTextPluginKey,

        state: {
          init: (): GhostState => ({ text: '', isPredicting: false }),
          apply(tr, prev): GhostState {
            const meta = tr.getMeta(ghostTextPluginKey) as GhostState | undefined;
            if (meta !== undefined) return meta;
            // Any real doc change (user typing, etc.) clears the suggestion
            if (tr.docChanged) return { text: '', isPredicting: false };
            return prev;
          },
        },

        props: {
          decorations(state) {
            const ghost = ghostTextPluginKey.getState(state);
            if (!ghost || (!ghost.text && !ghost.isPredicting)) {
              return DecorationSet.empty;
            }

            const pos = state.selection.$head.pos;

            // Guard: position must be within the document (Yjs/collab can
            // temporarily produce stale positions that exceed doc size)
            if (pos < 0 || pos > state.doc.content.size) {
              return DecorationSet.empty;
            }

            // Only render when we have actual text to show
            if (!ghost.text) return DecorationSet.empty;

            const wrapper = document.createElement('span');
            wrapper.className = 'ghost-text-widget';

            const textNode = document.createElement('span');
            textNode.className = 'ghost-text-content';
            textNode.textContent = ghost.text;
            wrapper.appendChild(textNode);

            const hint = document.createElement('kbd');
            hint.className = 'ghost-text-hint';
            hint.textContent = 'Tab accept';
            wrapper.appendChild(hint);

            // No static key — ProseMirror must replace the DOM node every
            // time the text changes (a static key causes it to reuse the old
            // DOM, which is why the text never appeared).
            try {
              return DecorationSet.create(state.doc, [
                Decoration.widget(pos, wrapper, { side: 1 }),
              ]);
            } catch {
              return DecorationSet.empty;
            }
          },
        },
      }),
    ];
  },
});
