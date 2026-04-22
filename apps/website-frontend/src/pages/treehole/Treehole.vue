<template>
  <div class="min-h-screen bg-primary-50 dark:bg-primary-950 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 页面标题 -->
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-50">
          🌳 树洞
        </h1>
        <Button
          label="首页"
          icon="pi pi-home"
          variant="secondary"
          @click="router.push('/')"
        />
      </div>

      <!-- 过滤器 -->
      <div class="mb-6 flex flex-wrap gap-2 items-center justify-between bg-white dark:bg-primary-900 rounded-lg shadow-sm p-4">
        <div class="flex gap-2">
          <Button
            v-for="filter in visibilityFilters"
            :key="filter.value"
            variant="ghost"
            :class="[currentFilter === filter.value ? filter.activeClass : filter.inactiveClass]"
            @click="currentFilter = filter.value"
          >
            <i :class="filter.icon"></i>
            <span class="ml-1">{{ filter.label }}</span>
          </Button>
        </div>

        <div class="relative">
          <Input
            v-model="searchKeyword"
            placeholder="搜索标题或内容..."
            class="w-48"
          >
            <template #prefix>
              <i class="pi pi-search"></i>
            </template>
          </Input>
        </div>
      </div>

      <!-- 创建帖子表单（展开/收起） -->
      <div class="mb-8">
        <Button
          :label="showCreateForm ? '收起创建表单' : '创建新主题'"
          :icon="showCreateForm ? 'pi pi-chevron-up' : 'pi pi-plus'"
          class="w-full mb-4"
          @click="showCreateForm = !showCreateForm"
        />
        <TreeholePostForm
          v-if="showCreateForm"
          @submit="handlePostCreated"
          @cancel="showCreateForm = false"
        />
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <ProgressSpinner />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="text-center">
        <Message variant="error" :closable="false">
          {{ error }}
        </Message>
      </div>

      <!-- 空状态 -->
      <div v-else-if="posts.length === 0" class="text-center">
        <div class="bg-white dark:bg-primary-900 rounded-lg shadow p-8">
          <i class="pi pi-comments text-4xl text-primary-400 mb-4"></i>
          <p class="text-primary-600 dark:text-primary-400 mb-4">
            {{ getEmptyMessage() }}
          </p>
          <Button
            v-if="currentFilter !== 'PUBLIC'"
            label="切换到公开内容"
            variant="secondary"
            @click="currentFilter = 'PUBLIC'"
          />
        </div>
      </div>

      <!-- 帖子列表 -->
      <div v-else>
        <TreeholePost
          v-for="post in posts"
          :key="post.id"
          :post="post"
          :depth="0"
          @updated="loadPosts"
          @deleted="loadPosts"
        />

        <!-- 加载更多 -->
        <div v-if="hasMore" class="text-center mt-8">
          <Button
            :label="isLoadingMore ? '加载中...' : '加载更多'"
            :icon="isLoadingMore ? 'pi pi-spin pi-spinner' : 'pi pi-chevron-down'"
            variant="secondary"
            :disabled="isLoadingMore"
            @click="loadMore"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { authInfo_isLogin, authInfo } from '@/storage';
import { useAPI } from '@/api';
import { Button, Input, Message, ProgressSpinner } from '@/components/base';
import { getErrorMessage } from '@/utils/error';
import TreeholePost from './TreeholePost.vue';
import TreeholePostForm from './TreeholePostForm.vue';
import { useDebounceFn } from '@vueuse/core';
import type { TreeholePost as TreeholePostType } from '@tsfullstack/backend';

const router = useRouter();

const { AppAPI } = useAPI();

const posts = ref<TreeholePostType[]>([]);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const error = ref('');
const showCreateForm = ref(false);
const searchKeyword = ref('');
const currentFilter = ref<'PUBLIC' | 'MEMBERS' | 'MY'>('PUBLIC');

/** 分页参数 */
const skip = ref(0);
const take = 10;
const hasMore = ref(false);

/** 可见性过滤器 */
const visibilityFilters = [
  {
    value: 'PUBLIC' as const,
    label: '公开',
    icon: 'pi pi-globe',
    activeClass: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
    inactiveClass: 'bg-white dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-700',
  },
  {
    value: 'MEMBERS' as const,
    label: '登录可见',
    icon: 'pi pi-users',
    activeClass: 'bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300',
    inactiveClass: 'bg-white dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-700',
  },
  {
    value: 'MY' as const,
    label: '我的',
    icon: 'pi pi-user',
    activeClass: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
    inactiveClass: 'bg-white dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-700',
  },
];

/**
 * 获取空状态消息
 */
function getEmptyMessage(): string {
  const messages = {
    PUBLIC: '还没有公开的树洞帖子，来创建一个吧！',
    MEMBERS: '还没有登录用户可见的帖子',
    MY: '你还没有发布过任何帖子',
  };
  return messages[currentFilter.value] || '暂无内容';
}

/**
 * 加载帖子列表
 */
async function loadPosts(reset = true) {
  if (isLoading.value) return;

  isLoading.value = true;
  error.value = '';

  try {
    if (reset) {
      skip.value = 0;
      posts.value = [];
    }

    // 构建查询参数
    const query = {
      skip: skip.value,
      take,
      onlyRoot: true,
    } as Parameters<typeof AppAPI.treeholeApi.queryPosts>[0];

    // 根据过滤器设置可见性
    if (currentFilter.value === 'PUBLIC') {
      query.visibility = 'PUBLIC';
    } else if (currentFilter.value === 'MEMBERS') {
      query.visibility = ['MEMBERS', 'PUBLIC'];
    } else if (currentFilter.value === 'MY') {
      if (authInfo_isLogin.value) {
        query.authorId = authInfo.value.userId;
      }
    }

    // 如果有搜索关键词
    if (searchKeyword.value.trim()) {
      query.keyword = searchKeyword.value.trim();
    }

    // 调用后端树洞 API
    const result = await AppAPI.treeholeApi.queryPosts(query);

    if (reset) {
      posts.value = result.posts;
    } else {
      posts.value.push(...result.posts);
    }

    // 判断是否还有更多数据
    hasMore.value = result.hasMore;
  } catch (err: unknown) {
    error.value = '加载失败：' + getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

/**
 * 加载更多
 */
async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return;

  isLoadingMore.value = true;
  skip.value += take;

  await loadPosts(false);

  isLoadingMore.value = false;
}

/**
 * 帖子创建成功后的处理
 */
function handlePostCreated() {
  showCreateForm.value = false;
  loadPosts();
}

// 防抖搜索
const debouncedSearch = useDebounceFn(() => {
  loadPosts();
}, 300);

// 监听搜索关键词变化
watch(searchKeyword, () => {
  debouncedSearch();
});

// 监听过滤器变化
watch(currentFilter, () => {
  loadPosts();
});

// 页面加载时获取帖子
onMounted(() => {
  loadPosts();
});
</script>

<style scoped>
/* 添加过渡动画 */
.treehole-post {
  transition: all 0.3s ease;
}
</style>
