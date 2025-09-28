<template>
  <div class="template-demo">
    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-cube"></i>
          <span>Module Template Demo</span>
        </div>
      </template>

      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <template #subtitle>基础信息</template>
            <div class="space-y-2">
              <p><strong>模块名称:</strong> Module Template</p>
              <p><strong>版本:</strong> 0.1.0</p>
              <p><strong>状态:</strong> <Tag severity="success" value="已启用" /></p>
            </div>
          </Card>

          <Card>
            <template #subtitle>功能特性</template>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <i class="pi pi-check text-green-500"></i>
                <span>自动路由加载</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="pi pi-check text-green-500"></i>
                <span>组件复用</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="pi pi-check text-green-500"></i>
                <span>类型安全</span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <template #subtitle>API 测试</template>
          <div class="space-y-4">
            <Button
              label="测试基础 API"
              @click="testBasicApi"
              :loading="loading.basic"
            />
            <Button
              label="测试共享包 API"
              @click="testSharedPackageApi"
              :loading="loading.shared"
              severity="secondary"
            />

            <div v-if="apiResult" class="mt-4">
              <Card>
                <template #subtitle>API 响应结果</template>
                <pre class="bg-gray-100 p-4 rounded text-sm overflow-auto">{{ apiResult }}</pre>
              </Card>
            </div>
          </div>
        </Card>

        <Card>
          <template #subtitle>导航测试</template>
          <div class="flex flex-wrap gap-2">
            <Button
              label="子页面 1"
              @click="router.push('/module-template/subpage1')"
              severity="info"
            />
            <Button
              label="子页面 2"
              @click="router.push('/module-template/subpage2')"
              severity="info"
            />
            <Button
              label="设置页面"
              @click="router.push('/module-template/settings')"
              severity="warning"
            />
          </div>
        </Card>
      </div>
    </Card>

    <!-- 子路由出口 -->
    <router-view class="mt-6" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = reactive({
  basic: false,
  shared: false
})

const apiResult = ref('')

const testBasicApi = async () => {
  loading.basic = true
  try {
    // 这里可以调用 module-template 的 API
    await new Promise(resolve => setTimeout(resolve, 1000))
    apiResult.value = JSON.stringify({
      message: '基础 API 测试成功',
      timestamp: new Date().toISOString(),
      data: {
        module: 'module-template',
        version: '0.1.0'
      }
    }, null, 2)
  } catch (error) {
    apiResult.value = `错误: ${error}`
  } finally {
    loading.basic = false
  }
}

const testSharedPackageApi = async () => {
  loading.shared = true
  try {
    // 这里可以测试共享包的 API
    await new Promise(resolve => setTimeout(resolve, 1000))
    apiResult.value = JSON.stringify({
      message: '共享包 API 测试成功',
      timestamp: new Date().toISOString(),
      sharedPackage: '@tsfullstack/shared-frontend',
      features: ['路由工具', '类型定义', '组件复用']
    }, null, 2)
  } catch (error) {
    apiResult.value = `错误: ${error}`
  } finally {
    loading.shared = false
  }
}
</script>

<style scoped>
.template-demo {
  margin: 0 auto;
  padding: 1.5rem;
  max-width: 1280px;
}
</style>