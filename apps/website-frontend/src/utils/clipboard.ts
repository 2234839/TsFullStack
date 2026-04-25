/**
 * 复制文本到剪贴板（带 fallback）
 *
 * 优先使用 Clipboard API，不可用时回退到 execCommand。
 * 统一封装避免各页面重复实现 fallback 逻辑。
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard API 不可用（HTTP 环境、旧浏览器等），回退到 execCommand
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
