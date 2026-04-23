<template>
  <div class="treehole-post" :class="{ 'pl-4 sm:pl-8 border-l-2 border-primary-200 dark:border-primary-700': depth > 0 }">
    <div class="bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-4 mb-4">
      <!-- 帖子头部：作者信息和时间 -->
      <div class="flex items-center justify-between mb-3">
        <div v-if="post.author" class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
            {{ getAuthorInitial(post.author) }}
          </div>
          <div>
            <div class="font-semibold text-primary-900 dark:text-primary-50">
              {{ post.author.nickname || t('匿名用户') }}
            </div>
            <div class="text-xs text-primary-500 dark:text-primary-400">
              {{ formatDate(post.updated, { relative: true }) }}
            </div>
          </div>
        </div>
        <div v-else class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-white font-bold">
            ?
          </div>
          <div>
            <div class="font-semibold text-primary-900 dark:text-primary-50">
              {{ t('未知用户') }}
            </div>
            <div class="text-xs text-primary-500 dark:text-primary-400">
              {{ formatDate(post.updated, { relative: true }) }}
            </div>
          </div>
        </div>

        <!-- 可见性标签和折叠按钮 -->
        <div class="flex items-center gap-2">
          <!-- 主贴折叠按钮 -->
          <Button
            v-if="!isReplying && depth > 0"
            :icon="isPostCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
            variant="text"
            size="small"
            @click="isPostCollapsed = !isPostCollapsed"
          />

          <span
            class="px-2 py-1 text-xs rounded-full"
            :class="getVisibilityClass(post.visibility)"
          >
            {{ getVisibilityLabel(post.visibility) }}
          </span>

          <!-- 操作菜单（仅作者可见） -->
          <div v-if="isAuthor" class="relative">
            <Button
              icon="pi pi-ellipsis-v"
              variant="text"
              size="small"
              @click="showMenu = !showMenu"
            />
            <div
              v-if="showMenu"
              class="absolute right-0 mt-2 w-48 bg-white dark:bg-primary-900 rounded-lg shadow-lg border border-primary-200 dark:border-primary-700 z-10"
            >
              <Button
                variant="ghost"
                class="w-full justify-start"
                icon="pi pi-pencil"
                @click="handleEdit"
              >
                {{ t('编辑') }}
              </Button>
              <Button
                variant="ghost"
                class="w-full justify-start text-danger-600"
                icon="pi pi-trash"
                @click="handleDelete"
              >
                {{ t('删除') }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- 帖子标题和内容(可折叠) -->
      <template v-if="!isPostCollapsed">
        <!-- 帖子标题 -->
        <h3 class="text-xl font-bold text-primary-900 dark:text-primary-50 mb-2">
          {{ post.title }}
        </h3>

        <!-- 帖子内容 -->
        <div class="text-primary-700 dark:text-primary-300 whitespace-pre-wrap mb-4">
          {{ post.content }}
        </div>
      </template>

      <!-- 折叠状态下的摘要 -->
      <div v-else class="text-primary-600 dark:text-primary-400 text-sm">
        {{ post.title || t('无标题') }} - {{ post.content.substring(0, 50) }}{{ post.content.length > 50 ? '...' : '' }}
      </div>

      <!-- 帖子底部：操作按钮和回复数 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button
            :label="isReplying ? t('取消回复') : t('回复')"
            :icon="isReplying ? 'pi pi-times' : 'pi pi-reply'"
            variant="text"
            size="small"
            @click="toggleReply"
          />
          <!-- 展开/收起回复按钮（放在卡片内部） -->
          <Button
            v-if="hasMoreReplies"
            :label="expandButtonText"
            :icon="repliesLoaded && isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            variant="text"
            size="small"
            @click="toggleExpand"
          />
        </div>
        <div class="flex items-center gap-1 text-sm text-primary-500 dark:text-primary-400">
          <i class="pi pi-comments"></i>
          <span>{{ post._count?.replies ?? 0 }} {{ t('条回复') }}</span>
        </div>
      </div>

      <!-- 回复编辑器 -->
      <div v-if="isReplying" class="mt-4 pt-4 border-t border-primary-200 dark:border-primary-700">
        <TreeholePostForm
          :parent-id="post.id"
          @submit="handleReplySubmit"
          @cancel="isReplying = false"
        />
      </div>
    </div>

    <!-- 子回复（递归渲染） -->
    <div v-if="repliesLoaded && isExpanded && replies.length > 0" class="replies-container">
      <TreeholePost
        v-for="reply in replies"
        :key="reply.id"
        :post="reply"
        :depth="depth + 1"
        @updated="emit('updated')"
        @deleted="emit('deleted')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { authInfo, authInfo_isLogin } from '@/storage';
import { useAPI } from '@/api';
import { Button } from '@/components/base';
import TreeholePostForm from './TreeholePostForm.vue';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import type { TreeholePost } from '@tsfullstack/backend';
import { getErrorMessage } from '@/utils/error';
import { useI18n } from '@/composables/useI18n';

interface Props {
  post: TreeholePost;
  /** 当前嵌套深度 */
  depth?: number;
}

const { post, depth = 0 } = defineProps<Props>()

const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const { API, AppAPI } = useAPI();
const toast = useToast();
const confirm = useConfirm();
const { t } = useI18n();

const showMenu = ref(false);
const isReplying = ref(false);
const isExpanded = ref(false);
const isPostCollapsed = ref(false); /** 主贴内容是否折叠 */
const replies = ref<TreeholePost[]>([]);
const repliesLoaded = ref(false);

/** 当前用户是否是帖子作者 */
const isAuthor = computed(() =>
  authInfo_isLogin.value ? authInfo.value.userId === post.authorId : false,
);

/** 是否有回复可以展开 */
const hasMoreReplies = computed(() => {
  const totalReplies = post._count?.replies || 0;
  // 如果回复还没加载过,只要有回复就可以展开
  if (!repliesLoaded.value) {
    return totalReplies > 0;
  }
  // 如果已加载,检查是否有未显示的回复
  return totalReplies > replies.value.length;
});

/** 展开按钮的文本 */
const expandButtonText = computed(() => {
  if (!repliesLoaded.value) {
    return t(`展开 ${post._count?.replies ?? 0} 条回复`);
  }
  return isExpanded.value ? t('收起回复') : t(`展开回复`);
});

/**
 * 获取作者首字母
 */
function getAuthorInitial(author: { nickname: string | null }): string {
  if (author.nickname) {
    return author.nickname.charAt(0).toUpperCase();
  }
  return '?';
}

/**
 * 格式化日期
 *
 * 问题说明：
 * - created 字段：SQLite 的 now() 返回 UTC 时间，正确
 * - updated 字段：Prisma @updatedAt 使用本地时间但被当作 UTC 存储，有 8 小时偏差
 *
 * 解决方案：优先使用 created 字段，因为它是正确的 UTC 时间
 */
import { formatDate } from '@/utils/format';

/**
 * 获取可见性样式
 */
function getVisibilityClass(visibility: string): string {
  const classes = {
    DRAFT: 'bg-primary-200 text-primary-700 dark:bg-primary-700 dark:text-primary-300',
    PRIVATE: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
    MEMBERS: 'bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300',
    PUBLIC: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
  };
  return classes[visibility as keyof typeof classes] || classes.DRAFT;
}

/**
 * 获取可见性标签
 */
function getVisibilityLabel(visibility: string): string {
  const labels = {
    DRAFT: t('草稿'),
    PRIVATE: t('私密'),
    MEMBERS: t('登录可见'),
    PUBLIC: t('公开'),
  };
  return labels[visibility as keyof typeof labels] || t('未知');
}

/**
 * 切换回复状态
 */
function toggleReply() {
  isReplying.value = !isReplying.value;

  // 如果首次展开且还没有加载回复，则加载回复
  if (isReplying.value && replies.value.length === 0) {
    loadReplies();
  }
}

/**
 * 切换展开/收起回复
 */
function toggleExpand() {
  // 如果还没加载过回复,先加载
  if (!repliesLoaded.value) {
    loadReplies();
  }
  isExpanded.value = !isExpanded.value;
}

/**
 * 加载回复
 */
async function loadReplies() {
  try {
    const result = await AppAPI.treeholeApi.queryPosts({
      skip: 0,
      take: 100, // 回复数量通常不会太多
      parentId: post.id,
    });

    replies.value = result.posts;
    repliesLoaded.value = true;
    isExpanded.value = true;
  } catch (error: unknown) {
    toast.add({
      variant: 'error',
      summary: t('错误'),
      detail: t('加载回复失败'),
      life: 3000,
    });
  }
}

/**
 * 处理回复提交
 */
function handleReplySubmit() {
  isReplying.value = false;
  emit('updated');
  loadReplies();
}

/**
 * 编辑帖子
 */
function handleEdit() {
  showMenu.value = false;
  /** 编辑功能待实现：需要打开编辑对话框预填当前内容，调用更新 API */
  toast.add({
    variant: 'info',
    summary: t('提示'),
    detail: t('编辑功能开发中'),
    life: 3000,
  });
}

/**
 * 删除帖子
 */
function handleDelete() {
  showMenu.value = false;

  confirm.require({
    message: t('确定要删除这条帖子吗？'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: t('取消'),
      variant: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: t('删除'),
      variant: 'danger',
    },
    accept: async () => {
      try {
        await API.db.post.delete({ where: { id: post.id } });
        toast.add({
          variant: 'success',
          summary: t('成功'),
          detail: t('删除成功'),
          life: 3000,
        });
        emit('deleted');
      } catch (error: unknown) {
        toast.add({
          variant: 'error',
          summary: t('错误'),
          detail: t('删除失败：') + getErrorMessage(error),
          life: 3000,
        });
      }
    },
  });
}

// 只有第一级回复(主题帖的直属回复)默认自动加载
// 子回复需要用户点击展开按钮才加载
if (depth === 0 && post._count?.replies && post._count.replies > 0) {
  loadReplies();
}
</script>

<style scoped>
.treehole-post {
  position: relative;
}

.replies-container {
  margin-top: 1rem;
}
</style>
