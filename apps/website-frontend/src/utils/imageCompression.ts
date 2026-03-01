/**
 * 图片压缩配置
 */
export interface ImageCompressionOptions {
  /** 目标格式 */
  format?: 'jpeg' | 'png' | 'webp';
  /** 最大尺寸 */
  maxSize?: { width: number; height: number };
  /** 压缩质量 (0-1) */
  quality?: number;
}

/**
 * 压缩图片
 * @param file - 原始图片文件
 * @param options - 压缩选项
 * @returns 压缩后的 Blob
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<Blob> {
  const {
    format = 'image/jpeg',
    maxSize,
    quality = 0.85,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 创建 Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法获取 Canvas 上下文'));
        return;
      }

      // 计算目标尺寸
      let width = img.width;
      let height = img.height;

      if (maxSize) {
        const ratio = Math.min(
          maxSize.width / width,
          maxSize.height / height,
          1
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height);

      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        format,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('图片加载失败'));
    };

    // 加载图片
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 压缩图片为 File
 * @param file - 原始图片文件
 * @param options - 压缩选项
 * @returns 压缩后的 File
 */
export async function compressImageToFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const blob = await compressImage(file, options);

  // 确定文件扩展名
  const format = options.format || 'image/jpeg';
  const extension = format.split('/')[1];

  // 创建新文件
  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, `.${extension}`),
    { type: format }
  );
}

/**
 * 获取图片尺寸
 * @param file - 图片文件
 * @returns 图片宽高
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error('无法读取图片尺寸'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 压缩配置预设
 */
export const compressionPresets = {
  /** 快速压缩（JPEG，质量 80，1024x1024） */
  fast: {
    format: 'image/jpeg' as const,
    quality: 0.8,
    maxSize: { width: 1024, height: 1024 },
  },

  /** 标准压缩（JPEG，质量 85，1024x1024） */
  standard: {
    format: 'image/jpeg' as const,
    quality: 0.85,
    maxSize: { width: 1024, height: 1024 },
  },

  /** 高质量压缩（WEBP，质量 90，保留原始尺寸） */
  high: {
    format: 'image/webp' as const,
    quality: 0.9,
  },

  /** 不压缩（保留原图） */
  none: {},
} as const;
