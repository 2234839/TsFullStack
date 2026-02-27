/** ABOUTME: 404 Not Found page */
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
    <div class="text-center p-8">
      <div class="text-9xl font-bold text-gray-300 dark:text-gray-600 mb-4">404</div>
      <h1 class="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {{ t('页面不存在') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        {{ t('抱歉，您访问的页面不存在或已被移动。') }}
      </p>
      <div class="space-x-4">
        <Button
          @click="router.go(-1)"
          :label="t('返回上页')"
          icon="pi pi-arrow-left"
          class="p-button-secondary"
        />
        <Button
          @click="router.push('/')"
          :label="t('返回首页')"
          icon="pi pi-home"
          class="p-button-primary"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { t } = useI18n()
</script>