<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">路由调试页面</h1>
    <div class="card">
      <h2 class="text-xl font-semibold mb-2">当前路由信息</h2>
      <p>总路由数: {{ routes.length }}</p>
      <div class="mt-4">
        <h3 class="text-lg font-medium mb-2">路由列表:</h3>
        <ul class="list-disc pl-6">
          <li v-for="route in routes" :key="route.path">
            {{ route.path }} - {{ route.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'

const router = useRouter()
const routes = router.getRoutes()

// 检查是否有测试模块路由
const testModuleRoute = routes.find(r => r.path === '/test-module')
console.log('Debug page - Routes:', routes)
console.log('Debug page - Test module route found:', !!testModuleRoute)
console.log('Debug page - All route paths:', routes.map(r => r.path))

// 在组件挂载时执行调试操作
onMounted(() => {
  console.log('✅ Debug page mounted successfully')
  console.log('📊 Available routes:', routes.map(r => r.path))
})
</script>