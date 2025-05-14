<template>
  <div class="min-h-screen">
    <!-- 头部区域 -->
    <div
      class="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-4xl font-bold text-center mb-4">{{ $t('TSFullStack') }}</h1>
      </div>
      <div><ThemeToggle /></div>
    </div>

    <!-- 功能卡片区域 -->
    <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Divider align="center">
        <span class="text-lg font-medium text-gray-700 dark:text-gray-300">{{
          $t('功能导航')
        }}</span>
      </Divider>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
        <!-- 管理系统卡片 -->
        <Card class="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800">
          <template #header>
            <img
              alt="管理系统"
              src="https://image.pollinations.ai/prompt/professional%20dashboard%20system%20interface,%20digital%20art?width=600&height=400&seed=1234&enhance=true&nologo=true&model=flux"
              class="w-full h-48 object-cover" />
          </template>
          <template #title>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-200">
              {{ $t('管理系统') }}
            </div>
          </template>
          <template #content>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('访问完整的管理后台，管理您的内容和设置') }}
            </p>
          </template>
          <template #footer>
            <RouterLink :to="routerUtil.to(routeMap.admin, {})" class="block w-full">
              <Button label="进入管理系统" icon="pi pi-cog" class="p-button-primary w-full" />
            </RouterLink>
          </template>
        </Card>

        <!-- NoteCalc卡片 -->
        <Card class="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800">
          <template #header>
            <img
              alt="NoteCalc"
              src="https://image.pollinations.ai/prompt/calculator%20application%20interface,%20colorful,%20modern%20design?width=600&height=400&seed=5678&enhance=true&nologo=true&model=flux"
              class="w-full h-48 object-cover" />
          </template>
          <template #title>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-200">
              {{ $t('NoteCalc在线计算') }}
            </div>
          </template>
          <template #content>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('强大的在线计算工具，支持笔记和复杂计算') }}
            </p>
          </template>
          <template #footer>
            <RouterLink :to="routerUtil.to(routeMap.noteCalc, {})" class="block w-full">
              <Button label="开始计算" icon="pi pi-calculator" class="p-button-success w-full" />
            </RouterLink>
          </template>
        </Card>

        <!-- 用户中心卡片 -->
        <Card class="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800">
          <template #header>
            <img
              alt="用户中心"
              src="https://image.pollinations.ai/prompt/user%20profile%20interface,%20login%20screen,%20modern%20UI?width=600&height=400&seed=9012&enhance=true&nologo=true&model=flux"
              class="w-full h-48 object-cover" />
          </template>
          <template #title>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-200">
              {{ $t('用户中心') }}
            </div>
          </template>
          <template #content>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('登录您的账户，访问个性化内容和设置') }}
            </p>
          </template>
          <template #footer>
            <RouterLink
              :to="routerUtil.to(routeMap.login, {}, { r: $route.fullPath })"
              class="block w-full">
              <Button label="登录" icon="pi pi-user" class="p-button-info w-full" />
            </RouterLink>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import ThemeToggle from '@/components/system/ThemeToggle.vue';
  import { routeMap, routerUtil } from '@/router';
  import { Button, Card, Divider } from 'primevue';
</script>
