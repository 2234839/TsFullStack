<template>
  <div class="subpage1">
    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-file"></i>
          <span>子页面 1</span>
        </div>
      </template>

      <div class="space-y-6">
        <Message severity="info" :closable="false">
          这是 Module Template 的子页面 1，演示了模块化路由的功能。
        </Message>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <template #subtitle>功能卡片 1</template>
            <div class="text-center">
              <i class="pi pi-chart-bar text-4xl text-blue-500 mb-2"></i>
              <p>数据分析功能</p>
            </div>
          </Card>

          <Card>
            <template #subtitle>功能卡片 2</template>
            <div class="text-center">
              <i class="pi pi-users text-4xl text-green-500 mb-2"></i>
              <p>用户管理功能</p>
            </div>
          </Card>

          <Card>
            <template #subtitle>功能卡片 3</template>
            <div class="text-center">
              <i class="pi pi-cog text-4xl text-orange-500 mb-2"></i>
              <p>系统配置功能</p>
            </div>
          </Card>
        </div>

        <Card>
          <template #subtitle>操作按钮</template>
          <div class="flex flex-wrap gap-2">
            <Button label="刷新数据" icon="pi pi-refresh" />
            <Button label="导出数据" icon="pi pi-download" severity="success" />
            <Button label="设置" icon="pi pi-cog" severity="warning" />
          </div>
        </Card>

        <div class="flex justify-between">
          <Button
            label="返回主页"
            icon="pi pi-arrow-left"
            @click="router.push('/module-template')"
            severity="secondary"
          />
          <Button
            label="前往子页面 2"
            icon="pi pi-arrow-right"
            @click="router.push('/module-template/subpage2')"
          />
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.subpage1 {
  margin: 0 auto;
  padding: 1.5rem;
  max-width: 1280px;
}
</style>