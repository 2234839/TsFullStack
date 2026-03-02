<template>
  <div class="treehole-post-form bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
    <div class="space-y-4">
      <!-- 标题输入 - 回复时默认折叠 -->
      <div v-if="isReply">
        <button @click="showTitle = !showTitle"
          class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <i :class="showTitle ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          <span>{{ showTitle ? '收起标题' : '添加标题（可选）' }}</span>
        </button>
        <div v-if="showTitle" class="mt-2">
          <Input v-model="formData.title" placeholder="请输入标题（1-256个字符）" :maxlength="256" class="w-full" />
        </div>
      </div>

      <!-- 发主题帖时标题必填 -->
      <div v-else>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          标题
        </label>
        <Input v-model="formData.title" placeholder="请输入标题（1-256个字符）" :maxlength="256" class="w-full" />
      </div>

      <!-- 内容输入 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          内容
        </label>
        <Textarea v-model="formData.content" :placeholder="isReply ? '说点什么吧...' : '说点什么吧...'" :rows="4" class="w-full" />
      </div>

      <!-- 可见性选择 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          可见性
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button v-for="option in visibilityOptions" :key="option.value" @click="formData.visibility = option.value"
            class="px-3 py-2 text-sm rounded-lg border-2 transition-colors"
            :class="formData.visibility === option.value ? option.activeClass : option.inactiveClass">
            <i :class="option.icon"></i>
            <span class="ml-1">{{ option.label }}</span>
          </button>
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ getVisibilityDescription() }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2">
        <Button v-if="showCancel" label="取消" variant="secondary" @click="$emit('cancel')" />
        <Button label="发布" :icon="isSubmitting ? 'pi pi-spin pi-spinner' : 'pi pi-send'"
          :disabled="!isValid || isSubmitting" @click="handleSubmit" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAPI } from '@/api';
import { Button, Input, Textarea } from '@/components/base';
import { useToast } from '@/composables/useToast';
import type { PostVisibility } from '@tsfullstack/backend';
import { $Enums } from '@tsfullstack/backend';
import { authInfo } from '@/storage';

interface Props {
  /** 父帖子ID（不传则为创建主题帖） */
  parentId?: number | null;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  parentId: null,
  showCancel: false,
});

const emit = defineEmits<{
  submit: [];
  cancel: [];
}>();

const { API } = useAPI();
const toast = useToast();

const isSubmitting = ref(false);
const showTitle = ref(false);

/** 是否为回复 */
const isReply = computed(() => props.parentId !== null);

/** 表单数据 */
const formData = ref({
  title: '',
  content: '',
  visibility: $Enums.PostVisibility.PUBLIC as PostVisibility,
});

/** 可见性选项 */
const visibilityOptions = [
  {
    value: $Enums.PostVisibility.DRAFT,
    label: '草稿',
    icon: 'pi pi-file',
    activeClass: 'border-gray-400 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
    description: '仅您可见，可随时编辑或发布',
  },
  {
    value: $Enums.PostVisibility.PRIVATE,
    label: '私密',
    icon: 'pi pi-eye-slash',
    activeClass: 'border-warning-500 bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
    description: '仅您可见，永久保密',
  },
  {
    value: $Enums.PostVisibility.MEMBERS,
    label: '登录用户',
    icon: 'pi pi-user',
    activeClass: 'border-info-500 bg-info-50 text-info-700 dark:bg-info-900 dark:text-info-300',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
    description: '所有登录用户可见',
  },
  {
    value: $Enums.PostVisibility.PUBLIC,
    label: '公开',
    icon: 'pi pi-globe',
    activeClass: 'border-success-500 bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
    description: '所有人可见，包括游客',
  },
];

/** 表单是否有效 */
const isValid = computed(() => {
  const hasContent = formData.value.content.trim().length > 0;
  const hasTitle = formData.value.title.trim().length > 0;

  // 回复时只需要内容，发主题帖时需要标题+内容
  return isReply.value ? hasContent : (hasTitle && hasContent);
});

/**
 * 获取当前可见性的描述
 */
function getVisibilityDescription(): string {
  const option = visibilityOptions.find((opt) => opt.value === formData.value.visibility);
  return option?.description || '';
}

/**
 * 提交表单
 */
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;

  isSubmitting.value = true;

  try {
    const createData: any = {
      content: formData.value.content,
      visibility: formData.value.visibility,
      authorId: authInfo.value.userId
    };

    // 只有当标题不为空时才添加 title 字段
    if (formData.value.title.trim()) {
      createData.title = formData.value.title;
    }

    // 如果是回复，添加 parentId
    if (props.parentId) {
      createData.parentId = props.parentId;
    }

    await API.db.post.create({
      data: createData,
    });

    toast.add({
      variant: 'success',
      summary: '成功',
      detail: props.parentId ? '回复成功' : '发布成功',
      life: 3000,
    });

    // 重置表单
    formData.value = {
      title: '',
      content: '',
      visibility: $Enums.PostVisibility.PUBLIC,
    };
    // 回复时收起标题字段
    if (isReply.value) {
      showTitle.value = false;
    }

    emit('submit');
  } catch (error) {
    console.error('发布失败:', error);
    toast.add({
      variant: 'error',
      summary: '错误',
      detail: '发布失败：' + ((error as Error).message || '未知错误'),
      life: 3000,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>
