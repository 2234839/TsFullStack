<template>
  <div class="min-w-[600px] p-4 text-nowrap pb-28">
    <div class="flex flex-col gap-4">
      <Button @click="openOptionsPage()" :label="'打开配置页面'" />

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center text-gray-500">加载中...</div>

      <!-- 没有未读记录 -->
      <div v-else-if="rulesWithUnread.length === 0" class="text-center text-gray-500">
        暂无未读执行记录
      </div>

      <!-- 执行记录区域 - 显示所有有未读记录的规则 -->
      <div v-else class="space-y-6">
        <div v-for="rule in rulesWithUnread" :key="rule.id" class="border-t">
          <h3 class="text-lg font-medium mb-3">{{ rule.name }} 的执行记录</h3>
          <RuleExecutionRecords
            :rule-id="rule.id"
            @read-status-changed="handleReadStatusChanged"
            @all-marked-as-read="handleAllMarkedAsRead" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { browser } from '#imports';
  import { Button } from 'primevue';
  import RuleExecutionRecords from '@/components/RuleExecutionRecords.vue';
  import { ref, onMounted } from 'vue';
  import { getTaskExecutionService } from '@/entrypoints/background/service/taskExecutionService';

  const taskExecutionService = getTaskExecutionService();

  // 有未读记录的规则详情列表
  const rulesWithUnread = ref<Array<{id: string, name: string}>>([]);
  const loading = ref(false);

  // 获取有未读记录的规则
  const loadRulesWithUnread = async () => {
    loading.value = true;
    try {
      rulesWithUnread.value = await taskExecutionService.getRulesWithUnreadExecutionsWithDetails();
      console.log('[rulesWithUnread.value]', rulesWithUnread.value);
    } catch (error) {
      console.error(' Failed to load rules with unread executions:', error);
    } finally {
      loading.value = false;
    }
  };

  function openOptionsPage() {
    browser.runtime.openOptionsPage();
  }

  // 处理读取状态变更事件
  const handleReadStatusChanged = (ruleId: string) => {
    console.log('Read status changed for rule:', ruleId);
    // 重新加载有未读记录的规则列表
    // loadRulesWithUnread();
  };

  // 处理全部标记为已读事件
  const handleAllMarkedAsRead = (ruleId: string) => {
  };

  // 组件挂载时加载有未读记录的规则
  onMounted(() => {
    loadRulesWithUnread();
  });
</script>
