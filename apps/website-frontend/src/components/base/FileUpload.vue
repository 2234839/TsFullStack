<script setup lang="ts">
/**
 * 文件上传组件
 * 使用 Tailwind CSS 样式
 */
import { ref } from 'vue';

interface Props {
  /** 接受的文件类型 */
  accept?: string;
  /** 选择按钮文本 */
  chooseLabel?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 模式 */
  mode?: 'basic' | 'advanced';
}

const props = withDefaults(defineProps<Props>(), {
  accept: '*',
  chooseLabel: '选择文件',
  disabled: false,
  mode: 'basic',
});

interface FileSelectEvent {
  files: File[];
}

const emit = defineEmits<{
  select: [event: FileSelectEvent];
}>();

/** 文件输入引用 */
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 触发文件选择 */
function chooseFile() {
  if (!props.disabled) {
    fileInputRef.value?.click();
  }
}

/** 处理文件选择 */
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);

  if (files.length > 0) {
    emit('select', { files });
  }

  // 清空输入值，允许重复选择同一文件
  target.value = '';
}
</script>

<template>
  <div class="file-upload">
    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      :disabled="disabled"
      class="hidden"
      @change="handleFileSelect" />
    <button
      type="button"
      :disabled="disabled"
      class="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700 text-white rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      @click="chooseFile">
      <i class="pi pi-upload mr-2"></i>
      {{ chooseLabel }}
    </button>
  </div>
</template>
