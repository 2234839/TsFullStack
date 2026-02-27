/**
 * AI 图片生成服务
 * 统一管理 AI 生成的图片来源，方便切换不同的图片服务提供商
 *
 * @example
 * ```ts
 * // 生成普通图片（卡片、封面等）
 * const url = generateAIImage('notecalc', 800, 600)
 *
 * // 生成全景图（VR 全景场景）
 * const panorama = generateAIPanorama('office')
 *
 * // 生成随机图片
 * const random = generateRandomAIImage(800, 600)
 * ```
 */
export class AIImageService {
  /**
   * 当前使用的 AI 图片服务提供商
   * 可选值: 'picsum' | 'placeholder' | 'pollinations' | 'custom'
   */
  private static provider: 'picsum' | 'placeholder' | 'pollinations' | 'custom' = 'picsum';

  /**
   * 设置 AI 图片服务提供商
   * @param provider - 服务提供商名称
   */
  static setProvider(provider: 'picsum' | 'placeholder' | 'pollinations' | 'custom'): void {
    this.provider = provider;
  }

  /**
   * 生成 AI 图片 URL（用于卡片、封面等）
   * @param prompt - 图片描述/提示词，相同内容生成相同图片
   * @param width - 图片宽度
   * @param height - 图片高度
   * @returns AI 生成的图片 URL
   */
  static generateImage(prompt: string, width: number = 800, height: number = 600): string {
    switch (this.provider) {
      case 'picsum':
        // Lorem Picsum - 稳定的随机图片服务
        return `https://picsum.photos/seed/${prompt}/${width}/${height}`;

      case 'placeholder':
        // Placehold.co - 占位图服务
        return `https://placehold.co/${width}x${height}?text=${encodeURIComponent(prompt)}`;

      case 'pollinations':
        // Pollinations AI - AI 生成服务（可能不稳定）
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true`;

      case 'custom':
        // 自定义服务，在这里实现你的逻辑
        return `https://via.placeholder.com/${width}x${height}?text=${encodeURIComponent(prompt)}`;

      default:
        return `https://picsum.photos/seed/${prompt}/${width}/${height}`;
    }
  }

  /**
   * 生成 AI 全景图片 URL（用于 VR 全景图）
   * @param sceneId - 场景 ID
   * @returns AI 生成的全景图片 URL
   */
  static generatePanorama(sceneId: string): string {
    // 使用 AI 图片服务生成全景占位图
    // 实际使用时应该上传真实的全景图图片
    return this.generateImage(`360-panorama-${sceneId}`, 2048, 1024);
  }

  /**
   * 生成随机 AI 图片 URL
   * @param width - 图片宽度
   * @param height - 图片高度
   * @returns 随机生成的图片 URL
   */
  static generateRandomImage(width: number = 800, height: number = 600): string {
    const randomSeed = Math.random().toString(36).substring(7);
    return this.generateImage(randomSeed, width, height);
  }
}

/**
 * 导出便捷函数
 * 使用更具语义化的函数名，明确表达这是 AI 生成的图片
 */
export const generateAIImage = (prompt: string, width?: number, height?: number) =>
  AIImageService.generateImage(prompt, width, height);

export const generateAIPanorama = (sceneId: string) =>
  AIImageService.generatePanorama(sceneId);

export const generateRandomAIImage = (width?: number, height?: number) =>
  AIImageService.generateRandomImage(width, height);
