<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 响应式容器，限制最大宽度适配 4K 屏幕 -->
    <!-- 页面标题区域 -->
    <div class="mb-8 p-4">
      <h1 class="text-4xl font-bold text-gray-900 mb-3">InfoFlow 配置</h1>
      <p class="text-lg text-gray-600">管理您的网页监控规则和过滤设置</p>
    </div>

    <!-- 主要内容区域 -->
    <div class="bg-white rounded-xl shadow-lg border border-gray-200">
      <div class="p-8">
        <RulesManagement />
      </div>
    </div>

    <!-- 页脚信息 -->
    <div class="mt-8 text-center text-sm text-gray-500">
      <p>InfoFlow 扩展 v{{ version }} - 智能网页信息监控</p>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
  import RulesManagement from '@/components/RulesManagement.vue';
  import { Toast } from 'primevue';
  import { version } from '../../package.json';
</script>

<style scoped></style>
