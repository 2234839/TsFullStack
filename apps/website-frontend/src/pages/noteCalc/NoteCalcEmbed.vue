<template>
  <div class="note-calc-embed">
    <div ref="editorRef" class="embed-editor"></div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref, shallowRef, watchEffect } from 'vue';
  import {
    EditorView,
    lineNumbers,
    dropCursor,
    keymap,
    Decoration,
    WidgetType,
    highlightActiveLine,
    highlightSpecialChars,
  } from '@codemirror/view';
  import { EditorState, Compartment, Range } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { useCalculator } from './useCalculator';
  import type { CalculationResult } from './types';
  import { theme_isDark } from '@/storage';

  const editorRef = ref<HTMLElement>();
  const view = shallowRef<EditorView>();
  const themeCompartment = new Compartment();

  const calculator = useCalculator({
    precision: 64,
    showPrecision: 4,
  });

  class ResultWidget extends WidgetType {
    constructor(
      public result: CalculationResult,
      public marginLeft: number = 16,
    ) {
      super();
    }

    toDOM() {
      const span = document.createElement('span');
      span.className = 'result-widget';
      span.style.marginLeft = `${this.marginLeft}px`;

      if (this.result.type === 'error') {
        span.classList.add('result-widget--error');
        span.textContent = `错误: ${this.result.error}`;
      } else if (this.result.result) {
        if (this.result.type === 'assignment' || this.result.type === 'expression' || this.result.type === 'unitConversion') {
          span.classList.add('result-widget--success');
        } else if (this.result.type === 'equation' && this.result.isCorrect === false) {
          span.classList.add('result-widget--warning');
        } else {
          span.classList.add('result-widget--normal');
        }

        if (this.result.isLargeNumber && this.result.formattedNumber) {
          span.textContent = `= ${this.result.formattedNumber}`;
        } else {
          span.textContent = `= ${this.result.result}`;
        }
      }

      return span;
    }

    ignoreEvent() {
      return false;
    }
  }

  let currentResults: CalculationResult[] = [];

  const decorationsExtension = EditorView.decorations.of((view: EditorView) => {
    const resultDecos = createResultDecorations(view.state.doc.toString(), currentResults);
    const highlightDecos = createSyntaxHighlightDecorations(view.state.doc.toString());
    const allDecos = [...resultDecos, ...highlightDecos];
    allDecos.sort((a, b) => a.from !== b.from ? a.from - b.from : a.to - b.to);
    return Decoration.set(allDecos);
  });

  function createSyntaxHighlightDecorations(content: string) {
    type HighlightRange = Range<Decoration>;
    const decorations: HighlightRange[] = [];
    const lines = content.split('\n');
    let pos = 0;

    for (const line of lines) {
      if (line.trim() === '') { pos += line.length + 1; continue; }

      const lineDecorations: HighlightRange[] = [];
      const titleMatch = line.match(/^(#{1,2})\s+(.*)/);
      if (titleMatch && titleMatch[1] && titleMatch[2] !== undefined) {
        const hashLength = titleMatch[1].length;
        lineDecorations.push(Decoration.mark({ class: hashLength === 1 ? 'syntax-h1-hash' : 'syntax-h2-hash' }).range(pos, pos + hashLength));
        lineDecorations.push(Decoration.mark({ class: hashLength === 1 ? 'syntax-h1-text' : 'syntax-h2-text' }).range(pos + hashLength + 1, pos + hashLength + 1 + titleMatch[2].length));
      } else if (!line.trim().startsWith('//')) {
        const numberRegex = /\b\d+\.?\d*([eE][+-]?\d+)?\b/g;
        let match;
        while ((match = numberRegex.exec(line)) !== null) {
          lineDecorations.push(Decoration.mark({ class: 'syntax-number' }).range(pos + match.index, pos + match.index + match[0].length));
        }
        const variableRegex = /[一-龥a-zA-Z_][一-龥a-zA-Z0-9_]*/g;
        numberRegex.lastIndex = 0;
        while ((match = variableRegex.exec(line)) !== null) {
          if (!numberRegex.test(match[0]) && !['sin', 'cos', 'tan', 'log', 'sqrt', 'PI', 'to'].includes(match[0])) {
            lineDecorations.push(Decoration.mark({ class: 'syntax-variable' }).range(pos + match.index, pos + match.index + match[0].length));
          }
          numberRegex.lastIndex = 0;
        }
        for (const func of ['sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'max', 'min', 'pow']) {
          const funcRegex = new RegExp(`\\b${func}\\b`, 'g');
          while ((match = funcRegex.exec(line)) !== null) {
            lineDecorations.push(Decoration.mark({ class: 'syntax-function' }).range(pos + match.index, pos + match.index + func.length));
          }
        }
      }

      lineDecorations.sort((a, b) => a.from !== b.from ? a.from - b.from : a.to - b.to);
      for (const item of lineDecorations) decorations.push(item);
      pos += line.length + 1;
    }
    return decorations;
  }

  function createResultDecorations(content: string, results: CalculationResult[]) {
    const widgets: Range<Decoration>[] = [];
    let pos = 0;
    const lines = content.split('\n');

    for (const [i, line] of lines.entries()) {
      if (i >= results.length) break;
      const result = results[i];
      if (!result || line === undefined) { pos += (line?.length ?? 0) + 1; continue; }

      pos += line.length;
      if (result.result !== undefined || result.type === 'error') {
        widgets.push(Decoration.widget({ widget: new ResultWidget(result, 16), side: 1 }).range(pos));
      }
      pos += 1;
    }
    return widgets;
  }

  async function calculateContent() {
    if (!view.value) return;
    currentResults = await calculator.calculateAll(view.value.state.doc.toString());
    view.value?.dispatch({ effects: [] });
  }

  const CM_SYNTAX_COLORS = {
    light: { '--cm-h1-hash-color': '#3b82f6', '--cm-h1-text-color': '#1e40af', '--cm-h2-hash-color': '#6366f1', '--cm-h2-text-color': '#4338ca', '--cm-number-color': '#059669', '--cm-variable-color': '#d97706', '--cm-function-color': '#7c3aed' },
    dark: { '--cm-h1-hash-color': '#60a5fa', '--cm-h1-text-color': '#dbeafe', '--cm-h2-hash-color': '#818cf8', '--cm-h2-text-color': '#e0e7ff', '--cm-number-color': '#34d399', '--cm-variable-color': '#fbbf24', '--cm-function-color': '#a78bfa' },
  } as const;

  const CM_EDITOR_COLORS = {
    light: { bg: '#ffffff', text: '#1f2937', gutterBg: '#f9fafb', gutterBorder: '#e5e7eb', lineNumber: '#9ca3af', caret: '#1f2937' },
    dark: { bg: '#1f2937', text: '#e5e7eb', gutterBg: '#1f2937', gutterBorder: '#374151', lineNumber: '#6b7280', caret: '#e5e7eb' },
  } as const;

  const customBaseTheme = EditorView.baseTheme({
    '& .syntax-h1-hash': { color: 'var(--cm-h1-hash-color)', fontWeight: '700' },
    '& .syntax-h1-text': { color: 'var(--cm-h1-text-color)', fontWeight: '700', fontSize: '1.25em' },
    '& .syntax-h2-hash': { color: 'var(--cm-h2-hash-color)', fontWeight: '600' },
    '& .syntax-h2-text': { color: 'var(--cm-h2-text-color)', fontWeight: '600', fontSize: '1.1em' },
    '& .syntax-number': { color: 'var(--cm-number-color)', fontWeight: '500' },
    '& .syntax-variable': { color: 'var(--cm-variable-color)', fontWeight: '500' },
    '& .syntax-function': { color: 'var(--cm-function-color)', fontWeight: '500' },
    '&light': { ...CM_SYNTAX_COLORS.light },
    '&dark': { ...CM_SYNTAX_COLORS.dark },
  });

  function createThemeExtension() {
    const isDark = theme_isDark.value;
    const colors = isDark ? CM_EDITOR_COLORS.dark : CM_EDITOR_COLORS.light;
    return EditorView.theme({
      '&': { backgroundColor: colors.bg, color: colors.text },
      '& .cm-gutter': { backgroundColor: colors.gutterBg, borderRight: `1px solid ${colors.gutterBorder}` },
      '& .cm-lineNumbers': { color: colors.lineNumber },
      '& .cm-content': { caretColor: colors.caret },
    }, { dark: isDark });
  }

  function updateTheme() {
    view.value?.dispatch({ effects: themeCompartment.reconfigure(createThemeExtension()) });
  }

  function initEditor() {
    if (!editorRef.value) return;

    /** 从 URL hash 获取初始内容 */
    const hashContent = window.location.hash.slice(1);
    let initialContent = '';
    if (hashContent) {
      try {
        initialContent = decodeURIComponent(hashContent);
        /** 将字面量 \n 替换为实际换行符 */
        initialContent = initialContent.replace(/\\n/g, '\n');
      } catch { initialContent = hashContent.replace(/\\n/g, '\n'); }
    }

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        history(),
        highlightSpecialChars(),
        highlightActiveLine(),
        dropCursor(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        customBaseTheme,
        themeCompartment.of(createThemeExtension()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) calculateContent();
        }),
        decorationsExtension,
      ],
    });

    view.value = new EditorView({ state, parent: editorRef.value });
    if (initialContent) calculateContent();
  }

  watchEffect(updateTheme);

  onMounted(initEditor);
  onUnmounted(() => {
    view.value?.destroy();
    view.value = undefined;
  });
</script>

<style scoped>
  .note-calc-embed {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background-color: #ffffff;
  }

  .dark .note-calc-embed {
    background-color: #1f2937;
  }

  .embed-editor {
    width: 100%;
    height: 100%;
  }

  :deep(.cm-editor) {
    height: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
  }

  :deep(.cm-scroller) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
  }

  :deep(.cm-content) {
    padding: 16px;
    max-width: none;
  }

  :deep(.cm-line) {
    padding: 0;
  }

  :deep(.cm-widget) {
    display: inline-flex;
    align-items: center;
    margin-left: 16px;
  }

  :deep(.result-widget) {
    padding: 2px 8px;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  :deep(.result-widget--success) {
    background-color: #dcfce7;
    color: #166534;
    border-left: 2px solid #22c55e;
  }

  :deep(.result-widget--error) {
    background-color: #fee2e2;
    color: #991b1b;
    border-left: 2px solid #ef4444;
  }

  :deep(.result-widget--warning) {
    background-color: #fef3c7;
    color: #92400e;
    border-left: 2px solid #f59e0b;
  }

  :deep(.result-widget--normal) {
    background-color: #f3f4f6;
    color: #374151;
  }
</style>
