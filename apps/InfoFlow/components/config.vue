<script setup lang="ts">
  import { ref } from 'vue';
  import { Card, InputText, Textarea, Button, Checkbox } from 'primevue';
  import { allRuleConfig, RuleConfig } from '@/storage/config';
  import { runTask } from '@/utils/runTask';
  import { computed } from '#imports';

  const ruleIndex = ref(0);

  const rule = computed<RuleConfig | undefined>(() => {
    return allRuleConfig[ruleIndex.value];
  });

  const addSelector = () => {
    rule.value!.target.selector.push('');
  };

  const removeSelector = (index: number) => {
    rule.value!.target.selector.splice(index, 1);
  };
</script>

<template>
  <Card class="max-w-3xl mx-auto p-4">
    <template #title>规则配置</template>
    <template #content>
      <div class="space-y-4" v-if="rule">
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label for="rule-name" class="block text-sm font-medium mb-2">规则名称</label>
            <InputText
              id="rule-name"
              v-model="rule.name"
              placeholder="例如: 科技新闻监控"
              class="w-full" />
          </div>
        </div>

        <Card>
          <template #title>目标配置</template>
          <template #content>
            <div class="space-y-4">
              <div>
                <label for="target-url" class="block text-sm font-medium mb-2">目标URL</label>
                <InputText
                  id="target-url"
                  v-model="rule.target.url"
                  placeholder="例如: https://example.com/news"
                  class="w-full" />
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">元素选择器</label>
                <div
                  v-for="(sel, index) in rule.target.selector"
                  :key="index"
                  class="flex gap-2 mb-2">
                  <InputText
                    v-model="rule.target.selector[index]"
                    placeholder="例如: .article-title"
                    class="flex-1" />
                  <Button icon="pi pi-times" severity="danger" @click="removeSelector(index)" />
                </div>
                <Button icon="pi pi-plus" label="添加选择器" @click="addSelector" />
              </div>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>触发配置</template>
          <template #content>
            <div>
              <label for="trigger-cron" class="block text-sm font-medium mb-2">Cron表达式</label>
              <InputText
                id="trigger-cron"
                v-model="rule.trigger.corn"
                placeholder="例如: 0 0 * * *"
                class="w-full" />
              <p class="text-xs text-gray-500 mt-1">使用cron语法定义触发时间</p>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>动作配置</template>
          <template #content>
            <div class="space-y-4">
              <div>
                <label for="ai-prompt" class="block text-sm font-medium mb-2">AI提示模板</label>
                <Textarea
                  id="ai-prompt"
                  v-model="rule.action.aiPrompt"
                  placeholder="例如: 用中文总结这篇科技文章的3个关键创新点: {extractedText}"
                  rows="5"
                  class="w-full" />
              </div>

              <div class="flex items-center">
                <Checkbox
                  v-model="rule.action.notification.enabled"
                  inputId="notification-enabled"
                  binary />
                <label for="notification-enabled" class="ml-2 text-sm font-medium">启用通知</label>
              </div>

              <div v-if="rule.action.notification.enabled">
                <label for="notification-format" class="block text-sm font-medium mb-2"
                  >通知格式</label
                >
                <InputText
                  id="notification-format"
                  v-model="rule.action.notification.format"
                  placeholder="例如: 检测到新文章: {summary}"
                  class="w-full" />
              </div>
            </div>
          </template>
        </Card>

        <Button label="测试运行" @click="runTask(rule)" type="submit" class="w-full" />
      </div>
    </template>
  </Card>
</template>
