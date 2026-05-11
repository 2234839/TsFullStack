<template>
  <div ref="editorRef" class="share-codemirror"></div>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
  import { EditorView, highlightActiveLine, highlightSpecialChars } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { markdown } from '@codemirror/lang-markdown';
  import { javascript } from '@codemirror/lang-javascript';
  import { json } from '@codemirror/lang-json';
  import { highlightActiveLineGutter } from '@codemirror/view';
  import { theme_isDark } from '@/storage';

  const { content, filename, readOnly = false } = defineProps<{
    content: string;
    filename: string;
    readOnly?: boolean;
  }>();

  const emit = defineEmits<{
    'update:content': [value: string];
  }>();

  const editorRef = ref<HTMLElement>();
  const view = shallowRef<EditorView>();
  const langCompartment = new Compartment();
  const themeCompartment = new Compartment();

  /** 根据文件名选择语言扩展 */
  function getLangExtension(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
        return markdown();
      case 'js':
      case 'ts':
      case 'javascript':
      case 'typescript':
        return javascript({ typescript: ext === 'ts' || ext === 'typescript' });
      case 'json':
        return json();
      default:
        return [];
    }
  }

  /** 创建主题 */
  function createTheme() {
    const isDark = theme_isDark.value;
    return EditorView.theme({
      '&': {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#e2e8f0' : '#1f2937',
        height: '100%',
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '14px',
        padding: '16px',
        caretColor: isDark ? '#e2e8f0' : '#1f2937',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#1e293b' : '#f9fafb',
        color: isDark ? '#64748b' : '#9ca3af',
        borderRight: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#e2e8f0' : '#1f2937',
      },
    }, { dark: isDark });
  }

  function initEditor() {
    if (!editorRef.value) return;

    const extensions = [
      langCompartment.of(getLangExtension(filename)),
      themeCompartment.of(createTheme()),
      EditorView.lineWrapping,
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(highlightSpecialChars());
    } else {
      extensions.push(highlightActiveLine());
      extensions.push(highlightActiveLineGutter());
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:content', update.state.doc.toString());
          }
        }),
      );
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    view.value = new EditorView({ state, parent: editorRef.value });
  }

  /** 外部内容变更时同步到编辑器 */
  watch(
    () => content,
    (newContent) => {
      if (!view.value) return;
      const current = view.value.state.doc.toString();
      if (current !== newContent) {
        view.value.dispatch({
          changes: { from: 0, to: current.length, insert: newContent },
        });
      }
    },
  );

  /** 文件名变更时切换语言 */
  watch(
    () => filename,
    (newFilename) => {
      view.value?.dispatch({
        effects: langCompartment.reconfigure(getLangExtension(newFilename)),
      });
    },
  );

  /** 暗色模式切换 */
  watch(
    () => theme_isDark.value,
    () => {
      view.value?.dispatch({
        effects: themeCompartment.reconfigure(createTheme()),
      });
    },
  );

  onMounted(initEditor);
  onUnmounted(() => {
    view.value?.destroy();
    view.value = undefined;
  });
</script>

<style scoped>
  .share-codemirror {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  :deep(.cm-editor) {
    height: 100%;
    outline: none;
  }

  :deep(.cm-scroller) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
</style>
