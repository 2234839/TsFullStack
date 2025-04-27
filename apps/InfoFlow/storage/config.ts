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
  target: TargetConfig;
  trigger: TriggerConfig;
  action: ActionConfig;
}
export const allRuleConfig = reactive<RuleConfig[]>([]);
storage.getItem('local:allRuleConfig').then((config: any) => {
  console.log('[config]', config);
  allRuleConfig.push(...(Object.values(config || []) as any));

  if (allRuleConfig.length == 0) {
    allRuleConfig.push(initRuleConfig());
  }
});
const saveConfig = useDebounceFn(() => {
  storage.setItem('local:allRuleConfig', allRuleConfig);
}, 300);
watch(allRuleConfig, saveConfig, { deep: true });

export function initRuleConfig(): RuleConfig {
  return {
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
