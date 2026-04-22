/** 一天的毫秒数 */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 日期格式化选项 */
export interface FormatDateOptions {
  /** null 值时的显示文本，默认为 '未知时间' */
  nullLabel?: string;
  /** 是否显示相对时间（如 "3分钟前"），默认 false */
  relative?: boolean;
  /** 是否仅显示日期不含时间，默认 false（含时间） */
  dateOnly?: boolean;
}

/**
 * 格式化文件大小（字节 → 人类可读）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

/**
 * 统一的日期格式化函数
 * 支持中文本地化、null 安全、可选的相对时间显示
 */
export function formatDate(date: string | Date | null | undefined, options: FormatDateOptions = {}): string {
  const { nullLabel = '未知时间', relative = false, dateOnly = false } = options;

  if (!date) return nullLabel;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return nullLabel;

  // 相对时间模式
  if (relative) {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    if (diffMs < 0) return '刚刚';
    if (diffMs < 60_000) return '刚刚';

    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 60) return `${diffMins}分钟前`;

    const diffHours = Math.floor(diffMs / 3_600_000);
    if (diffHours < 24) return `${diffHours}小时前`;

    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays < 7) return `${diffDays}天前`;

    // 超过7天回退到绝对日期
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  return dateOnly
    ? d.toLocaleDateString('zh-CN')
    : d.toLocaleString('zh-CN');
}

/**
 * 根据记忆等级返回颜色（红→黄→绿渐变）
 * level 范围 0-10，0 为红色（不熟悉），10 为绿色（熟悉）
 */
export function getMemoryColor(level: number): string {
  const normalizedLevel = Math.max(0, Math.min(10, level));
  const ratio = normalizedLevel / 10;
  if (ratio < 0.5) {
    return `rgb(255, ${Math.round(255 * (ratio * 2))}, 0)`;
  }
  return `rgb(${Math.round(255 * (2 - ratio * 2))}, 255, 0)`;
}
