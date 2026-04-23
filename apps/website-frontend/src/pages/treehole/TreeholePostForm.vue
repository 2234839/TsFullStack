<template>
  <div class="treehole-post-form bg-primary-50 dark:bg-primary-900 rounded-lg p-4">
    <div class="space-y-4">
      <!-- 标题输入 - 回复时默认折叠 -->
      <div v-if="isReply">
        <Button variant="ghost" size="sm" @click="showTitle = !showTitle"
          class="flex items-center gap-2">
          <i :class="showTitle ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          <span>{{ showTitle ? t('收起标题') : t('添加标题（可选）') }}</span>
        </Button>
        <div v-if="showTitle" class="mt-2">
          <Input v-model="formData.title" :placeholder="t('请输入标题（1-256个字符）')" :maxlength="256" class="w-full" />
        </div>
      </div>

      <!-- 发主题帖时标题必填 -->
      <div v-else>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('标题') }}
        </label>
        <Input v-model="formData.title" :placeholder="t('请输入标题（1-256个字符）')" :maxlength="256" class="w-full" />
      </div>

      <!-- 内容输入 -->
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
          {{ t('内容') }}
        </label>
        <Textarea v-model="formData.content" :placeholder="isReply ? t('说点什么吧...') : t('说点什么吧...')" :rows="4" class="w-full" />
      </div>

      <!-- 可见性选择 -->
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          {{ t('可见性') }}
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button v-for="option in visibilityOptions" :key="option.value"
            @click="formData.visibility = option.value"
            size="sm"
            :variant="formData.visibility === option.value ? 'primary' : 'secondary'"
            class="justify-center!">
            <i :class="option.icon"></i>
            <span class="ml-1">{{ option.label }}</span>
          </Button>
        </div>
        <p class="mt-2 text-xs text-primary-500 dark:text-primary-400">
          {{ getVisibilityDescription() }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2">
        <Button v-if="showCancel" :label="t('取消')" variant="secondary" @click="emit('cancel')" />
        <Button :label="t('发布')" :icon="isSubmitting ? 'pi pi-spin pi-spinner' : 'pi pi-send'"
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
import type { ContentVisibility } from '@tsfullstack/backend';
import { getErrorMessage } from '@/utils/error';
import { $Enums } from '@tsfullstack/backend';
import { authInfo } from '@/storage';
import { useI18n } from '@/composables/useI18n';

interface Props {
  /** 父帖子ID（不传则为创建主题帖） */
  parentId?: number | null;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
}

const { parentId = null, showCancel = false } = defineProps<Props>()

const emit = defineEmits<{
  submit: [];
  cancel: [];
}>();

const { API } = useAPI();
const toast = useToast();
const { t } = useI18n();

const isSubmitting = ref(false);
const showTitle = ref(false);

/** 是否为回复 */
const isReply = computed(() => parentId !== null);

/** 表单数据 */
const formData = ref({
  title: '',
  content: '',
  visibility: $Enums.ContentVisibility.PUBLIC as ContentVisibility,
});

/** 可见性选项 */
const visibilityOptions = [
  {
    value: $Enums.ContentVisibility.DRAFT,
    label: t('草稿'),
    icon: 'pi pi-file',
    activeClass: 'border-primary-400 bg-primary-100 text-primary-700 dark:bg-primary-700 dark:text-primary-300',
    inactiveClass: 'border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('仅您可见，可随时编辑或发布'),
  },
  {
    value: $Enums.ContentVisibility.PRIVATE,
    label: t('私密'),
    icon: 'pi pi-eye-slash',
    activeClass: 'border-warning-500 bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
    inactiveClass: 'border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('仅您可见，永久保密'),
  },
  {
    value: $Enums.ContentVisibility.MEMBERS,
    label: t('登录用户'),
    icon: 'pi pi-user',
    activeClass: 'border-info-500 bg-info-50 text-info-700 dark:bg-info-900 dark:text-info-300',
    inactiveClass: 'border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('所有登录用户可见'),
  },
  {
    value: $Enums.ContentVisibility.PUBLIC,
    label: t('公开'),
    icon: 'pi pi-globe',
    activeClass: 'border-success-500 bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300',
    inactiveClass: 'border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('所有人可见，包括游客'),
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
    const createData = {
      content: formData.value.content,
      visibility: formData.value.visibility,
      authorId: authInfo.value.userId,
      ...(formData.value.title.trim() ? { title: formData.value.title } : {}),
      ...(parentId ? { parentId } : {}),
    } as Parameters<typeof API.db.post.create>[0]['data'];

    await API.db.post.create({
      data: createData,
    });

    toast.add({
      variant: 'success',
      summary: t('成功'),
      detail: parentId ? t('回复成功') : t('发布成功'),
      life: 3000,
    });

    // 重置表单
    formData.value = {
      title: '',
      content: '',
      visibility: $Enums.ContentVisibility.PUBLIC,
    };
    // 回复时收起标题字段
    if (isReply.value) {
      showTitle.value = false;
    }

    emit('submit');
  } catch (error: unknown) {
    toast.add({
      variant: 'error',
      summary: t('错误'),
      detail: t('发布失败：') + getErrorMessage(error),
      life: 3000,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>
