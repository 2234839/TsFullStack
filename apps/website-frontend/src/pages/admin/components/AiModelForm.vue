<template>
  <Dialog
    v-model:open="localVisible"
    :title="isEdit ? t('编辑AI模型') : t('添加AI模型')"
  >

    <div class="space-y-4">
      <div class="field">
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('模型名称') }} <span class="text-danger-500 dark:text-danger-400">*</span>
        </label>
        <Input
          v-model="form.name"
          :placeholder="t('请输入模型名称')"
          :class="{ 'ring-2 ring-danger-500': errors.name }"
          @input="validateField('name')" />
        <small v-if="errors.name" class="text-danger-500 dark:text-danger-400">{{ errors.name }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('模型标识') }} <span class="text-danger-500 dark:text-danger-400">*</span>
        </label>
        <Input
          v-model="form.model"
          :placeholder="t('如：gpt-3.5-turbo, claude-3-sonnet')"
          :class="{ 'ring-2 ring-danger-500': errors.model }"
          @input="validateField('model')" />
        <small v-if="errors.model" class="text-danger-500 dark:text-danger-400">{{ errors.model }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('API基础URL') }} <span class="text-danger-500 dark:text-danger-400">*</span>
        </label>
        <Input
          v-model="form.baseUrl"
          :placeholder="t('请输入API基础URL')"
          :class="{ 'ring-2 ring-danger-500': errors.baseUrl }"
          @input="validateField('baseUrl')" />
        <small v-if="errors.baseUrl" class="text-danger-500 dark:text-danger-400">{{ errors.baseUrl }}</small>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('API密钥') }} <span class="text-danger-500 dark:text-danger-400">*</span>
        </label>
        <Password
          v-model="form.apiKey"
          :placeholder="t('请输入API密钥')"
          :feedback="false"
          toggleMask
          :class="{ 'ring-2 ring-danger-500': errors.apiKey }"
          @input="validateField('apiKey')" />
        <small v-if="errors.apiKey" class="text-danger-500 dark:text-danger-400">{{ errors.apiKey }}</small>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('最大Token数') }}
          </label>
          <InputNumber
            v-model="form.maxTokens"
            :placeholder="t('默认：2000')"
            :min="1"
            :max="32000"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('温度参数') }}
          </label>
          <InputNumber
            v-model="form.temperature"
            :placeholder="t('默认：0.7')"
            :min="0"
            :max="2"
            :step="0.1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('权重') }}
          </label>
          <InputNumber
            v-model="form.weight"
            :placeholder="t('默认：100')"
            :min="1"
            :max="1000"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('每分钟限制') }}
          </label>
          <InputNumber
            v-model="form.rpmLimit"
            :placeholder="t('默认：60')"
            :min="1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('每小时限制') }}
          </label>
          <InputNumber
            v-model="form.rphLimit"
            :placeholder="t('默认：1000')"
            :min="1"
            showButtons
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('每日限制') }}
          </label>
          <InputNumber
            v-model="form.rpdLimit"
            :placeholder="t('默认：10000')"
            :min="1"
            showButtons
            class="w-full" />
        </div>
      </div>

      <div class="field">
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('描述信息') }}
        </label>
        <Textarea
          v-model="form.description"
          :placeholder="t('请输入模型描述信息')"
          :rows="3"
          class="w-full" />
      </div>

      <div class="field">
        <div class="flex items-center">
          <Checkbox
            v-model="form.enabled"
            inputId="enabled"
            :binary="true" />
          <label for="enabled" class="ml-2 text-sm font-medium text-primary-700 dark:text-primary-300">
            {{ t('启用模型') }}
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('取消')"
          icon="pi pi-times"
          variant="text"
          @click="onCancel" />
        <Button
          :label="t('保存')"
          icon="pi pi-check"
          variant="primary"
          @click="onSubmit"
          :loading="loading" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useAPI } from '@/api'
import { useI18n } from '@/composables/useI18n'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/utils/error'
import { DEFAULT_MAX_TOKENS } from '@/utils/constants'
import { Dialog } from '@tsfullstack/shared-frontend/components'

/** AiModel 表单数据（与 AiModelVO 对齐，允许 null 表示新建模式） */
interface Props {
  open: boolean
  model?: Record<string, unknown> | null
}

const { open, model } = defineProps<Props>()

/** 组件事件定义 */
const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [model: Record<string, unknown>];
}>()

/** 本地的 open 状态，支持双向绑定 */
const localVisible = computed<boolean>({
  get: () => open,
  set: (value: boolean) => emit('update:open', value),
})

const { API } = useAPI()
const { t } = useI18n()
const toast = useToast()
const loading = ref(false)
const isEdit = ref(false)

/** AI 模型表单默认值 */
const DEFAULT_MODEL_FORM = {
  maxTokens: DEFAULT_MAX_TOKENS,
  temperature: 0.7,
  weight: 100,
  rpmLimit: 60,
  rphLimit: 1000,
  rpdLimit: 10000,
} as const

/** 表单数据 */
const form = reactive({
  name: '',
  model: '',
  baseUrl: '',
  apiKey: '',
  ...DEFAULT_MODEL_FORM,
  description: '',
  enabled: true
})

/** 错误信息 */
const errors = reactive({
  name: '',
  model: '',
  baseUrl: '',
  apiKey: ''
})

/** 验证规则 */
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
    ...DEFAULT_MODEL_FORM,
    description: '',
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

    if (isEdit.value && model) {
      // 编辑模式
      await API.db.aiModel.update({
        where: { id: (model?.id as number) },
        data: submitData
      })
    } else {
      // 添加模式
      await API.db.aiModel.create({
        data: submitData
      })
    }

    emit('submit', submitData)
    emit('update:open', false)
    resetForm()
  } catch (error: unknown) {
    toast.error(t('保存失败'), getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

const onCancel = () => {
  emit('update:open', false)
  resetForm()
}

// 监听 props 变化，初始化表单（合并 visible 和 model 的监听）
watch(
  [() => open, () => model],
  ([isVisible, currentModel]) => {
    if (isVisible && currentModel) {
      // 编辑模式
      isEdit.value = true
      Object.assign(form, {
        name: currentModel.name || '',
        model: currentModel.model || '',
        baseUrl: currentModel.baseUrl || '',
        apiKey: '', // API密钥不显示，需要重新输入
        ...DEFAULT_MODEL_FORM,
        maxTokens: currentModel.maxTokens ?? DEFAULT_MODEL_FORM.maxTokens,
        temperature: currentModel.temperature ?? DEFAULT_MODEL_FORM.temperature,
        weight: currentModel.weight ?? DEFAULT_MODEL_FORM.weight,
        rpmLimit: currentModel.rpmLimit ?? DEFAULT_MODEL_FORM.rpmLimit,
        rphLimit: currentModel.rphLimit ?? DEFAULT_MODEL_FORM.rphLimit,
        rpdLimit: currentModel.rpdLimit ?? DEFAULT_MODEL_FORM.rpdLimit,
        description: currentModel.description || '',
        enabled: currentModel.enabled ?? true
      })
    } else if (isVisible) {
      // 添加模式（对话框打开但无 model）
      isEdit.value = false
      resetForm()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.text-danger-500 {
  color: var(--color-danger-500);
}

:is(.dark .text-danger-500) {
  color: var(--color-danger-400);
}
</style>