<template>
  <div class="treehole-post" :class="{ 'pl-4 sm:pl-8 border-l-2 border-gray-200 dark:border-gray-700': depth > 0 }">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-4 mb-4">
      <!-- 帖子头部：作者信息和时间 -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
            {{ getAuthorInitial(post.author) }}
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-white">
              {{ post.author.nickname || post.author.email.split('@')[0] }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatDate(post.created) }}
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
              class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
            >
              <button
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                @click="handleEdit"
              >
                <i class="pi pi-pencil"></i>
                编辑
              </button>
              <button
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-danger-600 flex items-center gap-2"
                @click="handleDelete"
              >
                <i class="pi pi-trash"></i>
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 帖子标题和内容(可折叠) -->
      <template v-if="!isPostCollapsed">
        <!-- 帖子标题 -->
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {{ post.title }}
        </h3>

        <!-- 帖子内容 -->
        <div class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-4">
          {{ post.content }}
        </div>
      </template>

      <!-- 折叠状态下的摘要 -->
      <div v-else class="text-gray-600 dark:text-gray-400 text-sm">
        {{ post.title || '无标题' }} - {{ post.content.substring(0, 50) }}{{ post.content.length > 50 ? '...' : '' }}
      </div>

      <!-- 帖子底部：操作按钮和回复数 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button
            :label="isReplying ? '取消回复' : '回复'"
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
        <div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <i class="pi pi-comments"></i>
          <span>{{ post._count?.replies ?? 0 }} 条回复</span>
        </div>
      </div>

      <!-- 回复编辑器 -->
      <div v-if="isReplying" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
        @updated="$emit('updated')"
        @deleted="$emit('deleted')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAPI } from '@/api';
import { Button } from '@/components/base';
import TreeholePostForm from './TreeholePostForm.vue';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';

interface Author {
  id: string;
  email: string;
  nickname: string | null;
}

interface Post {
  id: number;
  title: string;
  content: string;
  visibility: 'DRAFT' | 'PRIVATE' | 'MEMBERS' | 'PUBLIC';
  created: Date;
  updated: Date;
  author: Author;
  parentId: number | null;
  _count?: {
    replies: number;
  };
}

interface Props {
  post: Post;
  /** 当前嵌套深度 */
  depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
});

const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const { API } = useAPI();
const toast = useToast();
const confirm = useConfirm();

const showMenu = ref(false);
const isReplying = ref(false);
const isExpanded = ref(false);
const isPostCollapsed = ref(false); /** 主贴内容是否折叠 */
const replies = ref<Post[]>([]);
const repliesLoaded = ref(false);

/** 当前用户是否是帖子作者 */
const isAuthor = computed(() => {
  // TODO: 从用户状态中获取当前用户ID
  // return currentUser.value?.id === props.post.author.id;
  return false;
});

/** 是否有回复可以展开 */
const hasMoreReplies = computed(() => {
  const totalReplies = props.post._count?.replies || 0;
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
    return `展开 ${props.post._count?.replies ?? 0} 条回复`;
  }
  return isExpanded.value ? '收起回复' : `展开回复`;
});

/**
 * 获取作者首字母
 */
function getAuthorInitial(author: Author): string {
  if (author.nickname) {
    return author.nickname.charAt(0).toUpperCase();
  }
  return author.email.charAt(0).toUpperCase();
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
function formatDate(dateStr: string | Date): string {
  let date: Date;

  if (dateStr instanceof Date) {
    date = dateStr;
  } else {
    // 字符串类型,直接解析（ISO 8601 格式会自动处理时区）
    date = new Date(dateStr);
  }

  // 如果日期无效,返回提示
  if (isNaN(date.getTime())) {
    return '未知时间';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // 检查时间是否异常(如果时间差为负数,说明时间有问题)
  if (diffMs < 0) {
    return '刚刚';
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  // 使用本地时区格式化日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 获取可见性样式
 */
function getVisibilityClass(visibility: string): string {
  const classes = {
    DRAFT: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
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
    DRAFT: '草稿',
    PRIVATE: '私密',
    MEMBERS: '登录可见',
    PUBLIC: '公开',
  };
  return labels[visibility as keyof typeof labels] || '未知';
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
    const result = await API.db.post.findMany({
      where: { parentId: props.post.id },
      orderBy: [{ created: 'asc' }],
      include: {
        author: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });

    // 为每个回复统计其直属子回复数
    const repliesWithCount = await Promise.all(
      result.map(async (reply: any) => {
        const directReplyCount = await API.db.post.count({
          where: { parentId: reply.id },
        });
        return {
          ...reply,
          _count: {
            replies: directReplyCount,
          },
        };
      })
    );

    replies.value = repliesWithCount as unknown as Post[];
    repliesLoaded.value = true;
    isExpanded.value = true;
  } catch (error) {
    console.error('加载回复失败:', error);
    toast.add({
      variant: 'error',
      summary: '错误',
      detail: '加载回复失败',
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
  // TODO: 实现编辑功能
  toast.add({
    variant: 'info',
    summary: '提示',
    detail: '编辑功能开发中',
    life: 3000,
  });
}

/**
 * 删除帖子
 */
function handleDelete() {
  showMenu.value = false;

  confirm.require({
    message: '确定要删除这条帖子吗？',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: '取消',
      variant: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '删除',
      variant: 'danger',
    },
    accept: async () => {
      try {
        await API.db.post.delete({ where: { id: props.post.id } });
        toast.add({
          variant: 'success',
          summary: '成功',
          detail: '删除成功',
          life: 3000,
        });
        emit('deleted');
      } catch (error) {
        console.error('删除失败:', error);
        toast.add({
          variant: 'error',
          summary: '错误',
          detail: '删除失败：' + ((error as Error).message || '未知错误'),
          life: 3000,
        });
      }
    },
  });
}

// 只有第一级回复(主题帖的直属回复)默认自动加载
// 子回复需要用户点击展开按钮才加载
if (props.depth === 0 && props.post._count?.replies && props.post._count.replies > 0) {
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
