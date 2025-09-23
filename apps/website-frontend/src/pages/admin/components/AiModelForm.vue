<template>
  <Dialog
    :visible="visible"
    :modal="true"
    :header="isEdit ? t('编辑AI模型') : t('添加AI模型')"
    class="p-fluid"
    style="max-width: 600px"
    @update:visible="emit('update:visible', $event)"
    @hide="onHide">

    <div class="space-y-4">
      <div class="field">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('模型名称') }} <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.name"
          :placeholder="$t('请输入模型名称')"
          :class="{ 'p-invalid': errors.name }"
          @input="validateField('name')" />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('模型标识') }} <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.model"
          :placeholder="$t('如：gpt-3.5-turbo, claude-3-sonnet')"
          :class="{ 'p-invalid': errors.model }"
          @input="validateField('model')" />
        <small v-if="errors.model" class="text-red-500">{{ errors.model }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('API基础URL') }} <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.baseUrl"
          :placeholder="$t('请输入API基础URL')"
          :class="{ 'p-invalid': errors.baseUrl }"
          @input="validateField('baseUrl')" />
        <small v-if="errors.baseUrl" class="text-red-500">{{ errors.baseUrl }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('API密钥') }} <span class="text-red-500">*</span>
        </label>
        <Password
          v-model="form.apiKey"
          :placeholder="$t('请输入API密钥')"
          :feedback="false"
          toggleMask
          :class="{ 'p-invalid': errors.apiKey }"
          @input="validateField('apiKey')" />
        <small v-if="errors.apiKey" class="text-red-500">{{ errors.apiKey }}</small>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('最大Token数') }}
          </label>
          <InputNumber
            v-model="form.maxTokens"
            :placeholder="$t('默认：2000')"
            :min="1"
            :max="32000"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('温度参数') }}
          </label>
          <InputNumber
            v-model="form.temperature"
            :placeholder="$t('默认：0.7')"
            :min="0"
            :max="2"
            :step="0.1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('权重') }}
          </label>
          <InputNumber
            v-model="form.weight"
            :placeholder="$t('默认：100')"
            :min="1"
            :max="1000"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('每分钟限制') }}
          </label>
          <InputNumber
            v-model="form.rpmLimit"
            :placeholder="$t('默认：60')"
            :min="1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('每小时限制') }}
          </label>
          <InputNumber
            v-model="form.rphLimit"
            :placeholder="$t('默认：1000')"
            :min="1"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('每日限制') }}
          </label>
          <InputNumber
            v-model="form.rpdLimit"
            :placeholder="$t('默认：10000')"
            :min="1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('描述信息') }}
        </label>
        <Textarea
          v-model="form.description"
          :placeholder="$t('请输入模型描述信息')"
          :rows="3"
          class="w-full" />
      </div>

      <div class="field">
        <div class="flex items-center">
          <Checkbox
            v-model="form.enabled"
            inputId="enabled"
            :binary="true" />
          <label for="enabled" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('启用模型') }}
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="$t('取消')"
          icon="pi pi-times"
          @click="onCancel"
          class="p-button-text" />
        <Button
          :label="$t('保存')"
          icon="pi pi-check"
          @click="onSubmit"
          :loading="loading"
          class="p-button-primary" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useAPI } from '@/api'
import { useI18n } from 'vue-i18n'
import { Button, Dialog, InputText, Password, InputNumber, Textarea, Checkbox } from 'primevue'

interface Props {
  visible: boolean
  model?: any
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'submit', model: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { API } = useAPI()
const { t } = useI18n()
const loading = ref(false)
const isEdit = ref(false)

// 表单数据
const form = reactive({
  name: '',
  model: '',
  baseUrl: '',
  apiKey: '',
  maxTokens: 2000,
  temperature: 0.7,
  weight: 100,
  rpmLimit: 60,
  rphLimit: 1000,
  rpdLimit: 10000,
  description: '',
  enabled: true
})

// 错误信息
const errors = reactive({
  name: '',
  model: '',
  baseUrl: '',
  apiKey: ''
})

// 验证规则
const validateField = (field: string) => {
  switch (field) {
    case 'name':
      errors.name = form.name.trim() ? '' : t('请输入模型名称')
      break
    case 'model':
      errors.model = form.model.trim() ? '' : t('请输入模型标识')
      break
    case 'baseUrl':
      errors.baseUrl = form.baseUrl.trim() ? '' : t('请输入API基础URL')
      break
    case 'apiKey':
      errors.apiKey = form.apiKey.trim() ? '' : t('请输入API密钥')
      break
  }
}

const validateForm = () => {
  validateField('name')
  validateField('model')
  validateField('baseUrl')
  validateField('apiKey')

  return !errors.name && !errors.model && !errors.baseUrl && !errors.apiKey
}

const resetForm = () => {
  Object.assign(form, {
    name: '',
    model: '',
    baseUrl: '',
    apiKey: '',
    maxTokens: 2000,
    temperature: 0.7,
    weight: 100,
    rpmLimit: 60,
    rphLimit: 1000,
    rpdLimit: 10000,
    description: '',
    enabled: true
  })

  Object.assign(errors, {
    name: '',
    model: '',
    baseUrl: '',
    apiKey: ''
  })
}

const onSubmit = async () => {
  if (!validateForm()) {
    return
  }

  loading.value = true
  try {
    const submitData = { ...form }

    if (isEdit.value && props.model) {
      // 编辑模式
      await API.db.aiModel.update({
        where: { id: props.model.id },
        data: submitData
      })
    } else {
      // 添加模式
      await API.db.aiModel.create({
        data: submitData
      })
    }

    emit('submit', submitData)
    emit('update:visible', false)
    resetForm()
  } catch (error) {
    console.error('保存AI模型失败:', error)
    alert(t('保存失败：') + ((error as Error).message || t('未知错误')))
  } finally {
    loading.value = false
  }
}

const onCancel = () => {
  emit('update:visible', false)
  resetForm()
}

const onHide = () => {
  resetForm()
}

// 监听props变化，初始化表单
watch(() => props.visible, (newVal) => {
  if (newVal && props.model) {
    // 编辑模式
    isEdit.value = true
    Object.assign(form, {
      name: props.model.name || '',
      model: props.model.model || '',
      baseUrl: props.model.baseUrl || '',
      apiKey: '', // API密钥不显示，需要重新输入
      maxTokens: props.model.maxTokens || 2000,
      temperature: props.model.temperature || 0.7,
      weight: props.model.weight || 100,
      rpmLimit: props.model.rpmLimit || 60,
      rphLimit: props.model.rphLimit || 1000,
      rpdLimit: props.model.rpdLimit || 10000,
      description: props.model.description || '',
      enabled: props.model.enabled ?? true
    })
  } else {
    // 添加模式
    isEdit.value = false
    resetForm()
  }
}, { immediate: true })

// 监听props.model变化
watch(() => props.model, (newVal) => {
  if (newVal && props.visible) {
    isEdit.value = true
    Object.assign(form, {
      name: newVal.name || '',
      model: newVal.model || '',
      baseUrl: newVal.baseUrl || '',
      apiKey: '', // API密钥不显示，需要重新输入
      maxTokens: newVal.maxTokens || 2000,
      temperature: newVal.temperature || 0.7,
      weight: newVal.weight || 100,
      rpmLimit: newVal.rpmLimit || 60,
      rphLimit: newVal.rphLimit || 1000,
      rpdLimit: newVal.rpdLimit || 10000,
      description: newVal.description || '',
      enabled: newVal.enabled ?? true
    })
  }
}, { immediate: true })
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.p-invalid {
  border-color: #ef4444 !important;
}

.text-red-500 {
  color: #ef4444;
}
</style>