<template>
  <div class="settings-page">
    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="pi pi-cog"></i>
          <span>模块设置</span>
        </div>
      </template>

      <div class="space-y-6">
        <Message severity="warn" :closable="false">
          这是 Module Template 的设置页面，展示了配置管理的功能。
        </Message>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <template #subtitle>基本设置</template>
            <div class="space-y-4">
              <div class="field">
                <label for="moduleName" class="block text-sm font-medium mb-2">模块名称</label>
                <InputText
                  id="moduleName"
                  v-model="settings.moduleName"
                  class="w-full"
                />
              </div>

              <div class="field">
                <label for="version" class="block text-sm font-medium mb-2">版本</label>
                <InputText
                  id="version"
                  v-model="settings.version"
                  class="w-full"
                  readonly
                />
              </div>

              <div class="field">
                <label for="status" class="block text-sm font-medium mb-2">状态</label>
                <Dropdown
                  id="status"
                  v-model="settings.status"
                  :options="statusOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                />
              </div>
            </div>
          </Card>

          <Card>
            <template #subtitle>高级设置</template>
            <div class="space-y-4">
              <div class="field">
                <label class="flex items-center gap-2">
                  <InputSwitch v-model="settings.enableAutoLoad" />
                  <span>启用自动加载</span>
                </label>
              </div>

              <div class="field">
                <label class="flex items-center gap-2">
                  <InputSwitch v-model="settings.enableDebug" />
                  <span>启用调试模式</span>
                </label>
              </div>

              <div class="field">
                <label for="maxItems" class="block text-sm font-medium mb-2">最大项目数</label>
                <InputNumber
                  id="maxItems"
                  v-model="settings.maxItems"
                  :min="1"
                  :max="1000"
                  class="w-full"
                />
              </div>

              <div class="field">
                <label for="timeout" class="block text-sm font-medium mb-2">超时时间 (ms)</label>
                <InputNumber
                  id="timeout"
                  v-model="settings.timeout"
                  :min="1000"
                  :max="60000"
                  :step="1000"
                  class="w-full"
                />
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <template #subtitle>功能开关</template>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="feature in features" :key="feature.key" class="flex items-center gap-2">
              <InputSwitch v-model="settings.features[feature.key as 'routing' | 'api' | 'components' | 'types' | 'testing']" />
              <span>{{ feature.label }}</span>
            </div>
          </div>
        </Card>

        <Card>
          <template #subtitle>操作</template>
          <div class="flex flex-wrap gap-2">
            <Button
              label="保存设置"
              icon="pi pi-save"
              @click="saveSettings"
              :loading="saving"
            />
            <Button
              label="重置为默认"
              icon="pi pi-undo"
              @click="resetSettings"
              severity="secondary"
            />
            <Button
              label="导出配置"
              icon="pi pi-download"
              @click="exportConfig"
              severity="success"
            />
            <Button
              label="导入配置"
              icon="pi pi-upload"
              @click="importConfig"
              severity="info"
            />
          </div>
        </Card>

        <div v-if="lastSaved" class="text-sm text-gray-500 text-center">
          最后保存时间: {{ lastSaved }}
        </div>

        <div class="flex justify-between">
          <Button
            label="返回子页面 2"
            icon="pi pi-arrow-left"
            @click="router.push('/module-template/subpage2')"
            severity="secondary"
          />
          <Button
            label="返回主页"
            icon="pi pi-home"
            @click="router.push('/module-template')"
          />
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const saving = ref(false)
const lastSaved = ref('')

const settings = reactive({
  moduleName: 'Module Template',
  version: '0.1.0',
  status: 'active',
  enableAutoLoad: true,
  enableDebug: false,
  maxItems: 100,
  timeout: 5000,
  features: {
    routing: true,
    api: true,
    components: true,
    types: true,
    testing: false
  }
})

const statusOptions = [
  { label: '激活', value: 'active' },
  { label: '停用', value: 'inactive' },
  { label: '维护中', value: 'maintenance' }
]

const features = [
  { key: 'routing', label: '路由功能' },
  { key: 'api', label: 'API 功能' },
  { key: 'components', label: '组件功能' },
  { key: 'types', label: '类型支持' },
  { key: 'testing', label: '测试功能' }
]

const saveSettings = async () => {
  saving.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    lastSaved.value = new Date().toLocaleString()

    // 这里可以调用 API 保存设置
    console.log('保存设置:', settings)

    alert('设置保存成功！')
  } catch (error) {
    alert('保存失败: ' + error)
  } finally {
    saving.value = false
  }
}

const resetSettings = () => {
  if (confirm('确定要重置为默认设置吗？')) {
    settings.moduleName = 'Module Template'
    settings.version = '0.1.0'
    settings.status = 'active'
    settings.enableAutoLoad = true
    settings.enableDebug = false
    settings.maxItems = 100
    settings.timeout = 5000
    settings.features = {
      routing: true,
      api: true,
      components: true,
      types: true,
      testing: false
    }
    lastSaved.value = ''
  }
}

const exportConfig = () => {
  const config = JSON.stringify(settings, null, 2)
  const blob = new Blob([config], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'module-template-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

const importConfig = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string)
          Object.assign(settings, config)
          alert('配置导入成功！')
        } catch (error) {
          alert('配置导入失败: ' + error)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}
</script>

<style scoped>
.settings-page {
  margin: 0 auto;
  padding: 1.5rem;
  max-width: 1280px;
}

.field {
  margin-bottom: 1rem;
}
</style>