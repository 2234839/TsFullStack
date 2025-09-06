import type { TaskResult, DataCollectionMethod } from '@/services/InfoFlowGet/messageProtocol';
import type { FilterConfig, RuleFilterConfig } from '@/entrypoints/background/service/dbService';

// 过滤服务 - 处理 JS 和 AI 过滤逻辑
export class FilterService {
  // 解析层次化过滤配置
  resolveFilterConfig(
    ruleFilterConfig?: RuleFilterConfig,
    globalFilterConfig?: FilterConfig,
  ): FilterConfig | null {
    if (!ruleFilterConfig) {
      // 如果规则没有过滤配置，使用全局配置
      return globalFilterConfig || null;
    }

    if (ruleFilterConfig.disableGlobalFilter) {
      // 如果禁用了全局过滤，则不应用任何过滤
      return null;
    }

    if (ruleFilterConfig.useGlobalFilter) {
      // 使用全局过滤配置
      return globalFilterConfig || null;
    }

    // 使用规则自定义过滤配置
    return ruleFilterConfig.filterConfig || null;
  }

  // 应用层次化过滤配置到任务结果
  async applyHierarchicalFilter(
    result: TaskResult,
    ruleFilterConfig?: RuleFilterConfig,
    globalFilterConfig?: FilterConfig,
  ): Promise<TaskResult> {
    // 解析过滤配置
    const filterConfig = this.resolveFilterConfig(ruleFilterConfig, globalFilterConfig);

    if (!filterConfig) {
      // 没有过滤配置，直接返回原始结果
      return result;
    }

    console.log('[FilterService] Applying hierarchical filter:', {
      ruleConfig: ruleFilterConfig,
      globalConfig: globalFilterConfig,
      resolvedConfig: filterConfig,
    });

    return this.applyFilter(result, filterConfig);
  }

  // 应用过滤规则到任务结果
  async applyFilter(result: TaskResult, filterConfig: FilterConfig): Promise<TaskResult> {
    if (!filterConfig.enable) {
      return result;
    }

    console.log('[FilterService] Applying filter:', filterConfig.filterType);

    // 复制原始结果
    const filteredResult = { ...result };

    // 处理不同类型的数据
    if (filteredResult.data && Array.isArray(filteredResult.data)) {
      filteredResult.data = await this.filterDataArray(filteredResult.data, filterConfig);
    }

    // 处理 collections
    if (filteredResult.collections) {
      for (const [key, collectionResult] of Object.entries(filteredResult.collections)) {
        if (collectionResult.items && Array.isArray(collectionResult.items)) {
          filteredResult.collections[key] = {
            ...collectionResult,
            items: await this.filterDataArray(collectionResult.items, filterConfig),
          };
        }
      }
    }

    // 更新匹配状态
    filteredResult.matched = this.hasFilteredContent(filteredResult) ? 1 : 0;

    console.log(
      '[FilterService] Filter applied. Original items:',
      this.countItems(result),
      'Filtered items:',
      this.countItems(filteredResult),
      filteredResult,
    );

    return filteredResult;
  }

  // 过滤数据数组
  private async filterDataArray(data: any[], filterConfig: FilterConfig): Promise<any[]> {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    switch (filterConfig.filterType) {
      case 'js':
        return this.applyJsFilter(data, filterConfig.jsFilter?.code || '');
      case 'ai':
        return this.applyAiFilter(data, filterConfig.aiFilter);
      default:
        return data;
    }
  }

  // 应用 JavaScript 过滤
  private applyJsFilter(data: any[], jsCode: string): any[] {
    if (!jsCode.trim()) {
      return data;
    }

    try {
      // 创建过滤函数
      const filterFunction = this.createJsFilterFunction(jsCode);

      // 应用过滤
      return data.filter((item) => {
        try {
          return filterFunction(item);
        } catch (error) {
          console.warn('[FilterService] JS filter error for item:', item, error);
          return true; // 过滤失败时保留该项
        }
      });
    } catch (error) {
      console.error('[FilterService] Failed to create JS filter function:', error);
      return data; // 创建函数失败时返回所有数据
    }
  }

  // 创建 JavaScript 过滤函数
  private createJsFilterFunction(jsCode: string): (item: any) => boolean {
    // 清理代码，移除注释和多余空格
    const cleanCode = jsCode
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
      .trim();

    // 创建函数体
    let functionBody = cleanCode;

    // 如果代码中没有定义 filterItem 函数，包装用户代码
    if (!cleanCode.includes('function filterItem') && !cleanCode.includes('const filterItem')) {
      functionBody = `
        try {
          ${cleanCode}
          return filterItem ? filterItem(item) : true;
        } catch (error) {
          return true;
        }
      `;
    }

    // 创建并返回函数
    return new Function('item', functionBody) as (item: any) => boolean;
  }

  // 应用 AI 过滤
  private async applyAiFilter(
    data: any[],
    aiConfig?: { model: string; prompt: string; ollamaUrl: string },
  ): Promise<any[]> {
    if (!aiConfig || !aiConfig.model || !aiConfig.prompt || !aiConfig.ollamaUrl) {
      console.warn('[FilterService] AI filter configuration incomplete');
      return data;
    }

    // 首先测试连接
    const connectionTest = await this.testOllamaConnection(aiConfig.ollamaUrl);
    if (!connectionTest.success) {
      console.warn('[FilterService] Ollama connection test failed:', connectionTest.error);
      return data; // 连接失败时返回所有数据
    }

    const filteredItems: any[] = [];

    // 对每个项目进行 AI 判断
    for (const item of data) {
      try {
        const shouldKeep = await this.aiShouldKeepItem(item, aiConfig);
        if (shouldKeep) {
          filteredItems.push(item);
        }
      } catch (error) {
        console.warn('[FilterService] AI filter error for item:', item, error);
        filteredItems.push(item); // AI 判断失败时保留该项
      }
    }

    return filteredItems;
  }

  // 测试 Ollama 连接
  private async testOllamaConnection(
    ollamaUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[FilterService] Testing Ollama connection to:', ollamaUrl);

      // 测试基本连接
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json();
      console.log(
        '[FilterService] Ollama connection test successful, available models:',
        result.models,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // AI 判断是否保留项目
  private async aiShouldKeepItem(
    item: any,
    aiConfig: { model: string; prompt: string; ollamaUrl: string },
  ): Promise<boolean> {
    try {
      // 构建提示词
      const itemContent = this.extractItemContent(item);
      const fullPrompt = `${aiConfig.prompt}\n\n内容：\n${itemContent}\n\n请回答"pass"或"block"，不要解释。`;

      console.log('[FilterService] Making AI request to:', `${aiConfig.ollamaUrl}/api/generate`);

      const requestBody = {
        model: aiConfig.model,
        /** 禁用思考 https://qwenlm.github.io/blog/qwen3/#advanced-usages */
        prompt: fullPrompt + ' /no_think ',
        stream: false,
      };

      console.log('[FilterService] Request body:', requestBody);

      const response = await fetch(`${aiConfig.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.warn(
          '[FilterService] AI filter request failed:',
          response.status,
          response.statusText,
        );
        // 网络错误时保留项目，避免误删
        return true;
      }

      const result = await response.json();
      const aiResponse = result.response?.toLowerCase() || '';

      console.log('[FilterService] AI response:', aiResponse);

      // 判断 AI 的响应
      return aiResponse.includes('pass');
    } catch (error) {
      console.warn('[FilterService] AI filter error:', error);
      // 发生错误时保留项目，避免误删
      return true;
    }
  }

  // 提取项目内容用于 AI 分析
  private extractItemContent(item: any): string {
    if (typeof item === 'string') {
      return item;
    }

    if (typeof item === 'object') {
      // 优先提取标题、内容、描述等字段
      const fields = ['title', 'content', 'description', 'text', 'name', 'value'];
      for (const field of fields) {
        if (item[field] && typeof item[field] === 'string') {
          return item[field];
        }
      }

      // 如果没有找到合适字段，返回对象的字符串表示
      return JSON.stringify(item);
    }

    return String(item);
  }

  // 计算结果中的项目总数
  private countItems(result: TaskResult): number {
    let count = 0;

    if (result.data && Array.isArray(result.data)) {
      count += result.data.length;
    }

    if (result.collections) {
      Object.values(result.collections).forEach((collectionResult) => {
        if (collectionResult.items && Array.isArray(collectionResult.items)) {
          count += collectionResult.items.length;
        }
      });
    }

    return count;
  }

  // 检查过滤后的结果是否还有内容
  private hasFilteredContent(result: TaskResult): boolean {
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      return true;
    }

    if (result.collections) {
      return Object.values(result.collections).some(
        (collectionResult) =>
          collectionResult.items &&
          Array.isArray(collectionResult.items) &&
          collectionResult.items.length > 0,
      );
    }

    return false;
  }
}

// 导出单例实例
export const filterService = new FilterService();
