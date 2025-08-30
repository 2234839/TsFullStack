/**
 * Cron 表达式解析工具
 */

export interface CronParts {
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
}

export interface ParsedCron {
  parts: CronParts;
  interval: {
    minutes?: number;
    hours?: number;
    days?: number;
  };
  type: 'fixed' | 'interval';
}

/**
 * 解析 cron 表达式
 */
export const parseCronExpression = (cronExpression: string): ParsedCron | null => {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return null;
    }

    const [minute, hour, day, month, weekday] = parts;

    const result: ParsedCron = {
      parts: { minute, hour, day, month, weekday },
      interval: {},
      type: 'fixed'
    };

    // 检查是否为间隔类型
    if (minute.includes('*/')) {
      result.interval.minutes = parseInt(minute.replace('*/', ''));
      result.type = 'interval';
    }

    if (hour.includes('*/')) {
      result.interval.hours = parseInt(hour.replace('*/', ''));
      result.type = 'interval';
    }

    if (day.includes('*/')) {
      result.interval.days = parseInt(day.replace('*/', ''));
      result.type = 'interval';
    }

    return result;
  } catch (error) {
    console.error('Failed to parse cron expression:', cronExpression, error);
    return null;
  }
};

/**
 * 计算下一个执行时间
 */
export const calculateNextExecution = (cronExpression: string, timeBase?: Date): Date | null => {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) {
    return null;
  }

  try {
    const { minute, hour, day, month, weekday } = parsed.parts;

    // 使用提供的时间基点，如果没有则使用当前时间
    const baseTime = timeBase || new Date();
    const next = new Date(baseTime);

    next.setSeconds(0);
    next.setMilliseconds(0);

    // 处理分钟字段
    if (minute.includes('*/')) {
      // 间隔格式，如 */5 表示每5分钟
      const interval = parseInt(minute.replace('*/', ''));
      const currentMinute = next.getMinutes();
      const minutesFromInterval = currentMinute % interval;
      const minutesToAdd = minutesFromInterval === 0 ? 0 : interval - minutesFromInterval;
      next.setMinutes(next.getMinutes() + minutesToAdd);
    } else if (minute !== '*') {
      // 固定分钟
      next.setMinutes(parseInt(minute));
    }

    // 处理小时字段
    if (hour.includes('*/')) {
      // 间隔格式，如 */2 表示每2小时
      const interval = parseInt(hour.replace('*/', ''));
      const currentHour = next.getHours();
      const hoursFromInterval = currentHour % interval;
      const hoursToAdd = hoursFromInterval === 0 ? 0 : interval - hoursFromInterval;
      next.setHours(next.getHours() + hoursToAdd);
    } else if (hour !== '*') {
      // 固定小时
      next.setHours(parseInt(hour));
    }

    // 处理天字段
    if (day.includes('*/')) {
      // 间隔格式，如 */7 表示每7天
      const interval = parseInt(day.replace('*/', ''));
      // 简化处理：从时间基点开始计算下一个执行时间
      if (timeBase) {
        const daysDiff = Math.floor((next.getTime() - timeBase.getTime()) / (24 * 60 * 60 * 1000));
        const daysFromInterval = daysDiff % interval;
        const daysToAdd = daysFromInterval === 0 ? 0 : interval - daysFromInterval;
        next.setDate(next.getDate() + daysToAdd);
      }
    } else if (day !== '*') {
      // 固定天数
      next.setDate(parseInt(day));
    }

    // 如果计算出的时间已经过去，则推迟到下一个周期
    const now = new Date();
    if (next <= now) {
      // 根据不同的 cron 表达式类型，增加相应的周期
      if (minute.includes('*/')) {
        const interval = parseInt(minute.replace('*/', ''));
        // 确保至少增加一个完整的周期
        next.setMinutes(next.getMinutes() + interval);
      } else if (hour.includes('*/')) {
        const interval = parseInt(hour.replace('*/', ''));
        next.setHours(next.getHours() + interval);
      } else if (day.includes('*/')) {
        const interval = parseInt(day.replace('*/', ''));
        next.setDate(next.getDate() + interval);
      } else {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  } catch (error) {
    console.error('Invalid cron expression:', cronExpression, error);
    return null;
  }
};

/**
 * 验证 cron 表达式是否有效
 */
export const isValidCronExpression = (cronExpression: string): boolean => {
  return parseCronExpression(cronExpression) !== null;
};

/**
 * 获取 cron 表达式的描述
 */
export const getCronDescription = (cronExpression: string): string => {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) {
    return '无效的 cron 表达式';
  }

  const { minute, hour, day, weekday } = parsed.parts;

  if (parsed.type === 'interval') {
    if (parsed.interval.minutes) {
      return `每 ${parsed.interval.minutes} 分钟执行一次`;
    } else if (parsed.interval.hours) {
      return `每 ${parsed.interval.hours} 小时执行一次`;
    } else if (parsed.interval.days) {
      return `每 ${parsed.interval.days} 天执行一次`;
    }
  }

  // 处理固定时间
  const minuteDesc = minute === '*' ? '每分钟' : `${minute}分`;
  const hourDesc = hour === '*' ? '每小时' : `${hour}点`;

  if (day === '*' && weekday === '*') {
    return `每天 ${hourDesc}${minuteDesc}`;
  } else if (day !== '*') {
    return `每月 ${day}日 ${hourDesc}${minuteDesc}`;
  } else if (weekday !== '*') {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const dayName = weekdays[parseInt(weekday)] || weekday;
    return `每星期${dayName} ${hourDesc}${minuteDesc}`;
  }

  return cronExpression;
};

/**
 * 获取 cron 表达式的执行间隔（毫秒）
 */
export const getCronInterval = (cronExpression: string): number => {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) {
    return 24 * 60 * 60 * 1000; // 默认1天
  }

  if (parsed.type === 'interval') {
    if (parsed.interval.minutes) {
      return parsed.interval.minutes * 60 * 1000;
    } else if (parsed.interval.hours) {
      return parsed.interval.hours * 60 * 60 * 1000;
    } else if (parsed.interval.days) {
      return parsed.interval.days * 24 * 60 * 60 * 1000;
    }
  }

  // 默认按天计算
  return 24 * 60 * 60 * 1000;
};

/**
 * 格式化倒计时时间
 */
export const formatCountdown = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks}周${days % 7}天`;
  } else if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
};