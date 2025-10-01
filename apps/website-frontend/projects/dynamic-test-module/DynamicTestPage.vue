/** ABOUTME: Dynamic test module page */
<template>
  <div class="p-6">
    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-bolt text-blue-500"></i>
          <span>动态测试模块</span>
        </div>
      </template>
      <template #content>
        <div class="space-y-4">
          <Message severity="info" :closable="false">
            这是一个动态加载的测试模块，演示了自动路由系统的功能。
          </Message>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <template #title>模块信息</template>
              <template #content>
                <div class="space-y-2">
                  <div><strong>模块路径：</strong> /dynamic-test-module</div>
                  <div><strong>加载方式：</strong> 动态自动加载</div>
                  <div><strong>路由类型：</strong> 项目路由</div>
                </div>
              </template>
            </Card>

            <Card>
              <template #title>功能特性</template>
              <template #content>
                <div class="space-y-2">
                  <div>✅ 自动路由发现</div>
                  <div>✅ 组件自动复制</div>
                  <div>✅ 路径自动重写</div>
                  <div>✅ 热重载支持</div>
                </div>
              </template>
            </Card>
          </div>

          <div class="mt-6">
            <Button
              label="测试按钮"
              icon="pi pi-check"
              @click="testFunction"
              class="mr-2"
            />
            <Button
              label="返回首页"
              icon="pi pi-home"
              @click="goHome"
              severity="secondary"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const testFunction = () => {
  alert('动态模块功能测试成功！')
}

const goHome = () => {
  router.push('/')
}
</script>