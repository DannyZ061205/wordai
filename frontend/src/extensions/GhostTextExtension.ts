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
            const wrapper = document.createElement('span');
            wrapper.className = 'ghost-text-widget';

            if (ghost.isPredicting && !ghost.text) {
              // Thinking indicator — three animated dots
              const dots = document.createElement('span');
              dots.className = 'ghost-text-thinking';
              dots.textContent = '●●●';
              wrapper.appendChild(dots);
            } else if (ghost.text) {
              const textNode = document.createElement('span');
              textNode.className = 'ghost-text-content';
              textNode.textContent = ghost.text;
              wrapper.appendChild(textNode);

              // "Tab" hint badge
              const hint = document.createElement('kbd');
              hint.className = 'ghost-text-hint';
              hint.textContent = 'Tab';
              wrapper.appendChild(hint);
            }

            return DecorationSet.create(state.doc, [
              Decoration.widget(pos, wrapper, { side: 1, key: 'ghost-text' }),
            ]);
          },
        },
      }),
    ];
  },
});
