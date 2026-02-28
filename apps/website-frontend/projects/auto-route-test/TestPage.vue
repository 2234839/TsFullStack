<template>
  <div class="min-h-screen bg-linear-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div class="flex items-center space-x-4 mb-8">
          <div class="w-16 h-16 bg-linear-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <i class="pi pi-sparkles text-white text-2xl"></i>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">自动路由测试页面</h1>
            <p class="text-gray-600 dark:text-gray-400">验证 Vite 自动路由生成系统</p>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-green-800 dark:text-green-300 mb-4">
              <i class="pi pi-check-circle mr-2"></i>
              系统状态
            </h2>
            <div class="space-y-2 text-green-700 dark:text-green-400">
              <p><i class="pi pi-cog mr-2"></i>Vite 插件: <span class="font-mono bg-green-100 dark:bg-green-800 px-2 py-1 rounded">运行中</span></p>
              <p><i class="pi pi-refresh mr-2"></i>热更新: <span class="font-mono bg-green-100 dark:bg-green-800 px-2 py-1 rounded">已启用</span></p>
              <p><i class="pi pi-folder mr-2"></i>路由扫描: <span class="font-mono bg-green-100 dark:bg-green-800 px-2 py-1 rounded">projects/*</span></p>
            </div>
          </div>

          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">
              <i class="pi pi-info-circle mr-2"></i>
              路由信息
            </h2>
            <div class="space-y-2 text-blue-700 dark:text-blue-400">
              <p><i class="pi pi-link mr-2"></i>当前路径: <span class="font-mono bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{{ $route.path }}</span></p>
              <p><i class="pi pi-clock mr-2"></i>生成时间: <span class="font-mono bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{{ new Date().toLocaleString() }}</span></p>
              <p><i class="pi pi-code mr-2"></i>文件位置: <span class="font-mono bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-sm">projects/auto-route-test/main.routeMap.ts</span></p>
            </div>
          </div>

          <div class="flex space-x-4">
            <Button @click="$router.push('/')" class="flex items-center space-x-2">
              <i class="pi pi-home"></i>
              <span>返回首页</span>
            </Button>
            <Button @click="$router.push('/dynamic-test-module')" variant="outline" class="flex items-center space-x-2">
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