<template>
  <div class="treehole-post-form bg-primary-card rounded-lg p-4">
    <!-- 未登录提示：发布需要登录，但草稿可先写，登录后自动继续 -->
    <Message v-if="!authInfo_isLogin" variant="info" :closable="false" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ t('发布帖子需要先登录，您写的内容会保留，登录后自动发布') }}</span>
        <Button :label="t('去登录')" icon="pi pi-sign-in" size="sm" @click="loginOpen = true" />
      </div>
    </Message>

    <div class="space-y-4">
      <!-- 标题输入 - 回复时默认折叠 -->
      <div v-if="isReply">
        <Button variant="ghost" size="sm" @click="showTitle = !showTitle" class="flex items-center gap-2">
          <i :class="showTitle ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          <span>{{ showTitle ? t('收起标题') : t('添加标题（可选）') }}</span>
        </Button>
        <div v-if="showTitle" class="mt-2">
          <Input
            v-model="formData.title"
            :placeholder="t('请输入标题（1-256个字符）')"
            :maxlength="256"
            class="w-full"
          />
        </div>
      </div>

      <!-- 发主题帖时标题必填 -->
      <div v-else>
        <label class="block text-sm font-medium text-primary-label mb-1">
          {{ t('标题') }}
        </label>
        <Input v-model="formData.title" :placeholder="t('请输入标题（1-256个字符）')" :maxlength="256" class="w-full" />
      </div>

      <!-- 内容输入 -->
      <div>
        <label class="block text-sm font-medium text-primary-label mb-1">
          {{ t('内容') }}
        </label>
        <Textarea
          v-model="formData.content"
          :placeholder="isReply ? t('说点什么吧...') : t('说点什么吧...')"
          :rows="4"
          class="w-full"
        />
      </div>

      <!-- 附件：静态 HTML 演示文件（仅主题帖） -->
      <div v-if="!isReply">
        <label class="block text-sm font-medium text-primary-label mb-1">
          {{ t('HTML 演示文件（可选）') }}
        </label>
        <div class="flex items-center gap-2">
          <input ref="htmlInputRef" type="file" accept=".html,.htm" class="hidden" @change="handleHtmlSelect" />
          <Button
            :label="htmlFile ? htmlFile.name : t('选择 HTML 文件')"
            :icon="htmlFile ? 'pi pi-file-code' : 'pi pi-upload'"
            variant="secondary"
            size="sm"
            @click="htmlInputRef?.click()"
          />
          <Button
            v-if="htmlFile"
            :label="t('移除')"
            icon="pi pi-times"
            variant="text"
            size="sm"
            @click="removeHtmlFile"
          />
        </div>
        <p class="mt-1 text-xs text-primary-subtle">
          {{ t('上传自包含的纯静态 HTML（≤2MB），帖子内将以沙箱 iframe 展示运行效果，并生成可分享链接') }}
        </p>
      </div>

      <!-- 可见性选择 -->
      <div>
        <label class="block text-sm font-medium text-primary-label mb-2">
          {{ t('可见性') }}
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            v-for="option in visibilityOptions"
            :key="option.value"
            @click="formData.visibility = option.value"
            size="sm"
            :variant="formData.visibility === option.value ? 'primary' : 'secondary'"
            class="justify-center!"
          >
            <i :class="option.icon"></i>
            <span class="ml-1">{{ option.label }}</span>
          </Button>
        </div>
        <p class="mt-2 text-xs text-primary-subtle">
          {{ getVisibilityDescription() }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2">
        <Button v-if="showCancel" :label="t('取消')" variant="secondary" @click="emit('cancel')" />
        <Button
          :label="!authInfo_isLogin ? t('登录并发布') : t('发布')"
          :icon="!authInfo_isLogin ? 'pi pi-sign-in' : isSubmitting ? 'pi pi-spin pi-spinner' : 'pi pi-send'"
          :disabled="isSubmitting || (authInfo_isLogin && !isValid)"
          @click="handlePublishClick"
        />
      </div>
    </div>

    <!-- 登录浮层：登录成功不导航，自动继续提交，草稿不丢 -->
    <LoginOverlay v-model:open="loginOpen" @success="handleSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue';
import { useAPI } from '@/api';
import { useToast } from '@/composables/useToast';
import type { ContentVisibility } from '@tsfullstack/backend';
import { apiErrorDetail } from '@/utils/error';
import { $Enums } from '@tsfullstack/backend';
import { authInfo, authInfo_isLogin } from '@/storage';
import LoginOverlay from '@/components/common/LoginOverlay.vue';
import { useI18n } from '@/composables/useI18n';

interface Props {
  /** 父帖子ID（不传则为创建主题帖） */
  parentId?: number | null;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
}

const { parentId = null, showCancel = false } = defineProps<Props>();

const emit = defineEmits<{
  submit: [];
  cancel: [];
}>();

const { API } = useAPI();
const toast = useToast();
const { t } = useI18n();

const isSubmitting = shallowRef(false);
const showTitle = shallowRef(false);

/** 选中的 HTML 演示文件（仅主题帖可附带） */
const htmlFile = shallowRef<File | null>(null);
const htmlInputRef = ref<HTMLInputElement | null>(null);

/** 登录浮层开关 */
const loginOpen = shallowRef(false);

/**
 * 发布按钮点击：未登录时按钮可点击，先弹登录浮层（表单组件不卸载，草稿保留），
 * 登录成功后由 LoginOverlay 的 success 回调自动调 handleSubmit 继续发布；
 * 已登录则走表单校验后提交
 */
function handlePublishClick() {
  if (isSubmitting.value) return;
  if (!authInfo_isLogin.value) {
    loginOpen.value = true;
    return;
  }
  if (!isValid.value) return;
  handleSubmit();
}

/** 是否为回复 */
const isReply = computed(() => parentId !== null);

/** 表单数据 */
const formData = ref({
  title: '',
  content: '',
  visibility: $Enums.ContentVisibility.PUBLIC as ContentVisibility,
});

/** 可见性选项（computed 确保 i18n 切换时更新） */
const visibilityOptions = computed(() => [
  {
    value: $Enums.ContentVisibility.DRAFT,
    label: t('草稿'),
    icon: 'pi pi-file',
    activeClass: 'border-primary-400 bg-primary-100 text-primary-700 dark:bg-primary-700 dark:text-primary-300',
    inactiveClass: 'border-primary-default text-primary-theme hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('仅您可见，可随时编辑或发布'),
  },
  {
    value: $Enums.ContentVisibility.PRIVATE,
    label: t('私密'),
    icon: 'pi pi-eye-slash',
    activeClass: 'border-warning-500 bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
    inactiveClass: 'border-primary-default text-primary-theme hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('仅您可见，永久保密'),
  },
  {
    value: $Enums.ContentVisibility.MEMBERS,
    label: t('登录用户'),
    icon: 'pi pi-user',
    activeClass: 'border-info-500 bg-info-50 text-info-700 dark:bg-info-900 dark:text-info-300',
    inactiveClass: 'border-primary-default text-primary-theme hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('所有登录用户可见'),
  },
  {
    value: $Enums.ContentVisibility.PUBLIC,
    label: t('公开'),
    icon: 'pi pi-globe',
    activeClass: 'border-success-500 bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300',
    inactiveClass: 'border-primary-default text-primary-theme hover:bg-primary-50 dark:hover:bg-primary-800',
    description: t('所有人可见，包括游客'),
  },
]);

/** 表单是否有效 */
const isValid = computed(() => {
  const hasContent = formData.value.content.trim().length > 0;
  const hasTitle = formData.value.title.trim().length > 0;

  // 回复时只需要内容，发主题帖时需要标题+内容
  return isReply.value ? hasContent : hasTitle && hasContent;
});

/**
 * 获取当前可见性的描述
 */
function getVisibilityDescription(): string {
  const option = visibilityOptions.value.find((opt) => opt.value === formData.value.visibility);
  return option?.description ?? '';
}

/** 选择/移除 HTML 演示文件 */
function handleHtmlSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  htmlFile.value = input.files?.[0] ?? null;
}

function removeHtmlFile() {
  htmlFile.value = null;
  if (htmlInputRef.value) htmlInputRef.value.value = '';
}

/** 上传 HTML 演示文件，返回文件 ID */
async function uploadHtmlFile(): Promise<number | undefined> {
  if (!htmlFile.value) return undefined;
  const uploaded = await API.fileApi.uploadHtmlEmbed(htmlFile.value);
  return uploaded.id;
}

/**
 * 提交表单
 */
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;

  isSubmitting.value = true;

  try {
    /** 先上传 HTML 演示文件拿到文件 ID，再创建帖子 */
    const embedHtmlId = await uploadHtmlFile();

    const createData = {
      content: formData.value.content,
      visibility: formData.value.visibility,
      authorId: authInfo.value.userId,
      ...(embedHtmlId !== undefined ? { embedHtmlId } : {}),
      ...(formData.value.title.trim() ? { title: formData.value.title } : {}),
      ...(parentId ? { parentId } : {}),
    } as Parameters<typeof API.db.post.create>[0]['data'];

    await API.db.post.create({
      data: createData,
    });

    toast.success(t('成功'), parentId ? t('回复成功') : t('发布成功'));

    // 重置表单
    formData.value = {
      title: '',
      content: '',
      visibility: $Enums.ContentVisibility.PUBLIC,
    };
    removeHtmlFile();
    // 回复时收起标题字段
    if (isReply.value) {
      showTitle.value = false;
    }

    emit('submit');
  } catch (error: unknown) {
    toast.error(t('错误'), apiErrorDetail(t('发布失败：'), error));
  } finally {
    isSubmitting.value = false;
  }
}
</script>
