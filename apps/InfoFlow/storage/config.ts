import { storage } from '#imports';
import { useDebounceFn } from '@vueuse/core';
import { reactive } from 'vue';

interface TargetConfig {
  url: string;
  selector: string[];
}

interface TriggerConfig {
  corn: string;
}

interface NotificationConfig {
  enabled: boolean;
  format: string;
}

interface ActionConfig {
  aiPrompt: string;
  notification: NotificationConfig;
}

export interface RuleConfig {
  name: string;
  id: string;
  target: TargetConfig;
  trigger: TriggerConfig;
  action: ActionConfig;
}
export const allRuleConfig = reactive<RuleConfig[]>([]);
const storeKey = 'local:allRuleConfig_v0'; // 使用版本号来区分不同的存储格式
storage.getItem(storeKey).then((config: any) => {
  console.log('[config]', config);
  allRuleConfig.push(...(Object.values(config || []) as any));

  if (allRuleConfig.length == 0) {
    allRuleConfig.push(initRuleConfig());
  }
});
const saveConfig = useDebounceFn(() => {
  storage.setItem(storeKey, allRuleConfig);
}, 300);
watch(allRuleConfig, saveConfig, { deep: true });

export function initRuleConfig(): RuleConfig {
  return {
    id: crypto.randomUUID(), // 使用 nanoid 生成唯一的 id
    name: '',
    target: {
      url: '',
      selector: [''],
    },
    trigger: {
      corn: '0 0 * * *',
    },
    action: {
      aiPrompt: '',
      notification: {
        enabled: true,
        format: '',
      },
    },
  };
}
