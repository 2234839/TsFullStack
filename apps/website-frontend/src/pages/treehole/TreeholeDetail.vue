<!-- ABOUTME: 树洞帖子详情页 — /treehole/:id，getPostTree 加载主帖，TreeholePost 组件渲染（回复自动加载） -->
<template>
  <div class="min-h-screen bg-primary-50 dark:bg-primary-950 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <!-- 顶部导航：返回树洞 -->
      <Button
        :label="t('返回树洞')"
        icon="pi pi-arrow-left"
        variant="text"
        class="mb-4"
        @click="routerUtil.push(routeMap.treehole, {})"
      />

      <!-- 加载中 -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <ProgressSpinner />
      </div>

      <!-- 不存在 / 无权限 -->
      <div v-else-if="!post" class="text-center">
        <div class="bg-white dark:bg-primary-900 rounded-lg shadow p-8">
          <i class="pi pi-exclamation-circle text-4xl text-primary-400 mb-4"></i>
          <p class="text-primary-theme mb-4">{{ t('帖子不存在或无权查看') }}</p>
          <Button :label="t('返回树洞')" variant="secondary" @click="routerUtil.push(routeMap.treehole, {})" />
        </div>
      </div>

      <!-- 帖子详情（回复由组件自动加载） -->
      <TreeholePost v-else :key="post.id" :post="post" :depth="0" @updated="loadPost" @deleted="onDeleted" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { useAPI } from '@/api';
import { routeMap, routerUtil } from '@/router';
import { useI18n } from '@/composables/useI18n';
import { ProgressSpinner } from '@/components/base';
import TreeholePost from './TreeholePost.vue';
import type { TreeholePost as TreeholePostType } from '@tsfullstack/backend';

const { t } = useI18n();
const { AppAPI } = useAPI();

const post = shallowRef<TreeholePostType | null>(null);
const isLoading = shallowRef(false);

/** 路由参数：帖子 id（routerUtil.push 以 params 传入） */
const { id } = defineProps<{ id: string }>();

/** 加载帖子（getPostTree 含 IDOR 防护，无权返回 null） */
async function loadPost() {
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    post.value = null;
    return;
  }
  isLoading.value = true;
  try {
    post.value = await AppAPI.treeholeApi.getPostTree(postId);
  } catch {
    post.value = null;
  } finally {
    isLoading.value = false;
  }
}

/** 帖子被删除：回列表页 */
function onDeleted() {
  routerUtil.push(routeMap.treehole, {});
}

loadPost();
</script>
