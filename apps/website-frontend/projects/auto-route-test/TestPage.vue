<template>
  <div class="min-h-screen bg-linear-to-br from-secondary-50 to-info-50 dark:from-primary-900 dark:to-primary-800 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white dark:bg-primary-800 rounded-2xl shadow-xl p-8">
        <div class="flex items-center space-x-4 mb-8">
          <div class="w-16 h-16 bg-linear-to-r from-success-400 to-info-500 rounded-full flex items-center justify-center">
            <i class="pi pi-sparkles text-white text-2xl"></i>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-50">自动路由测试页面</h1>
            <p class="text-primary-600 dark:text-primary-400">验证 Vite 自动路由生成系统</p>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-success-800 dark:text-success-300 mb-4">
              <i class="pi pi-check-circle mr-2"></i>
              系统状态
            </h2>
            <div class="space-y-2 text-success-700 dark:text-success-400">
              <p><i class="pi pi-cog mr-2"></i>Vite 插件: <span class="font-mono bg-success-100 dark:bg-success-800 px-2 py-1 rounded">运行中</span></p>
              <p><i class="pi pi-refresh mr-2"></i>热更新: <span class="font-mono bg-success-100 dark:bg-success-800 px-2 py-1 rounded">已启用</span></p>
              <p><i class="pi pi-folder mr-2"></i>路由扫描: <span class="font-mono bg-success-100 dark:bg-success-800 px-2 py-1 rounded">projects/*</span></p>
            </div>
          </div>

          <div class="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-info-800 dark:text-info-300 mb-4">
              <i class="pi pi-info-circle mr-2"></i>
              路由信息
            </h2>
            <div class="space-y-2 text-info-700 dark:text-info-400">
              <p><i class="pi pi-link mr-2"></i>当前路径: <span class="font-mono bg-info-100 dark:bg-info-800 px-2 py-1 rounded">{{ $route.path }}</span></p>
              <p><i class="pi pi-clock mr-2"></i>生成时间: <span class="font-mono bg-info-100 dark:bg-info-800 px-2 py-1 rounded">{{ new Date().toLocaleString() }}</span></p>
              <p><i class="pi pi-code mr-2"></i>文件位置: <span class="font-mono bg-info-100 dark:bg-info-800 px-2 py-1 rounded text-sm">projects/auto-route-test/main.routeMap.ts</span></p>
            </div>
          </div>

          <div class="flex space-x-4">
            <Button @click="$router.push('/')" class="flex items-center space-x-2">
              <i class="pi pi-home"></i>
              <span>返回首页</span>
            </Button>
            <Button @click="$router.push('/dynamic-test-module')" variant="ghost" class="flex items-center space-x-2">
              <i class="pi pi-bolt"></i>
              <span>动态测试模块</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 自动路由测试页面
// 无需额外逻辑，完全通过 Vite 插件自动发现和注册
</script>