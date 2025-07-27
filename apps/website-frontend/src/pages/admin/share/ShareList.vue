<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ $t('分享管理') }}</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ $t('浏览和管理您的分享') }}
        </p>
      </div>

      <ShareForm @success="shareList.execute()" />

      <!-- 加载状态 -->
      <div v-if="shareList.isLoading.value" class="flex justify-center items-center h-64">
        <ProgressSpinner />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="shareList.error.value" class="text-center">
        <Message severity="error" :closable="false">
          {{ shareList.error.value }}
        </Message>
      </div>

      <!-- 空状态 -->
      <div v-else-if="shareList.state.value.total === 0" class="text-center">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <i class="pi pi-images text-4xl text-gray-400 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('暂无分享') }}
          </p>
        </div>
      </div>

      <!-- 画廊网格 -->
      <div v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <div
            v-for="item in shareList.state.value.data"
            :key="item.id"
            class="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
            @click="handleCardClick(item as any)">
            <ShareCard :data="(item as any)" />

            <!-- 标题和文件信息 -->
            <div class="p-4">
              <div class="flex items-center">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate mb-2">
                  {{ (item.data as unknown as ShareJSON).title }}
                </h3>
                <div class="flex-1"></div>
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-secondary p-button-text p-2 mr-1"
                  @click.stop="handleEdit(item as any)"
                  :aria-label="$t('编辑')" />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-danger p-button-text p-2"
                  @click.stop="handleDelete(item as any)"
                  :aria-label="$t('删除')" />
              </div>

              <div
                class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span
                  >{{ (item.data as unknown as ShareJSON).files.length }} {{ $t('个文件') }}</span
                >
                <span>{{
                  formatFileSize(getTotalFileSize(item.data as unknown as ShareJSON))
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="flex justify-center">
          <Paginator
            :rows="shareList.params.take"
            :total-records="shareList.state.value.total"
            :first="shareList.params.skip"
            @page="onPageChange" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import ShareCard from '@/pages/admin/share/ShareCard.vue';
  import {
    formatFileSize,
    getTotalFileSize,
    type ShareItemJSON,
    type ShareJSON,
  } from '@/pages/admin/share/ShareDef';
  import ShareForm from '@/pages/admin/share/ShareForm.vue';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { useAsyncState } from '@vueuse/core';
  import type { Prisma } from 'tsfullstack-backend';
  import { reactive } from 'vue';

  const { API, APIGetUrl } = useAPI();

  // 定义 emits
  const emit = defineEmits<{
    (e: 'edit', item: ShareItemJSON): void;
    (e: 'delete', item: ShareItemJSON): void;
  }>();

  function useShareList() {
    const params = reactive({
      skip: 0,
      take: 12,
    });

    // 构建 Prisma 查询条件
    const where = reactive<Prisma.UserDataWhereInput>({
      appId: userDataAppid.shareInfo,
    });
    const orderBy: Prisma.UserDataOrderByWithRelationInput[] = [{ created: 'desc' }];

    async function fetchUsers() {
      const [data, total] = await Promise.all([
        API.db.userData.findMany({
          where,
          orderBy,
          include: {
            user: true,
          },
          skip: params.skip,
          take: params.take,
        }),
        API.db.userData.count({ where }),
      ]);
      return { data, total };
    }

    const { state, error, isLoading, execute } = useAsyncState(
      () => {
        return fetchUsers();
      },
      {
        data: [],
        total: 0,
      },
    );

    return {
      state,
      error,
      isLoading,
      execute,
      params,
    };
  }

  const shareList = useShareList();

  const onPageChange = (event: any) => {
    shareList.params.skip = event.first;
    shareList.execute();
  };

  // 卡片点击处理
  const handleCardClick = (item: ShareItemJSON) => {
    // 可以在这里添加查看详情的逻辑
    console.log('查看分享详情:', item);
  };

  // 编辑处理
  const handleEdit = (item: ShareItemJSON) => {
    emit('edit', item);
  };

  // 删除处理
  const handleDelete = async (item: ShareItemJSON) => {
    if (confirm('确定要删除这个分享吗？')) {
      try {
        if (item.data.files.length) {
          await Promise.all(item.data.files.map((el) => API.fileApi.delete(el.id)));
        }

        await API.db.userData.delete({
          where: {
            id: item.id,
          },
        });
        shareList.execute(); // 刷新列表
      } catch (error) {
        console.error('删除失败:', error);
      }
    }
  };
</script>

<style scoped>
  /* 添加一些额外的样式来增强视觉效果 */
  .group:hover .absolute {
    transform: translateX(2px) translateY(2px);
  }

  .group:hover .absolute:nth-child(2) {
    transform: translateX(4px) translateY(4px);
  }

  .group:hover .absolute:nth-child(3) {
    transform: translateX(6px) translateY(6px);
  }
</style>
