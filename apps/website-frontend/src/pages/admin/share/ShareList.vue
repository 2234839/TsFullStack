<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('分享管理') }}</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ t('浏览和管理您的分享') }}
        </p>
      </div>

      <div class="mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div class="relative w-full sm:w-1/3">
          <InputText v-model="searchTitle" :placeholder="t('搜索')" class="w-full pl-10" />
        </div>
        <Button
          :label="t('新建分享')"
          icon="pi pi-plus"
          @click="openCreateDialog"
          class="p-button-success self-end sm:self-auto" />
      </div>

      <ShareForm
        :visible="dialogVisible"
        :editing-item="editingItem"
        @update:visible="dialogVisible = $event"
        @success="handleSuccess" />

      <!-- QR码对话框 -->
      <Dialog
        v-model:visible="qrDialogVisible"
        :header="t('分享二维码')"
        :modal="true"
        :style="{ width: '300px' }"
        :closable="true"
        class="p-fluid">
        <div class="text-center">
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {{ (selectedQRItem?.data as unknown as ShareJSON)?.title }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('扫描二维码访问分享') }}
            </p>
          </div>

          <div class="flex justify-center mb-4">
            <img
              v-if="qrCodeDataUrl"
              :src="qrCodeDataUrl"
              :alt="t('分享二维码')"
              class="border border-gray-300 dark:border-gray-600 rounded-lg"
              width="200"
              height="200" />
            <div v-else class="w-52 h-52 flex items-center justify-center text-gray-500">
              {{ t('生成二维码中...') }}
            </div>
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400 break-all">
            {{ currentShareUrl }}
          </div>

          <div class="mt-4">
            <Button
              :label="t('复制链接')"
              icon="pi pi-copy"
              class="p-button-sm"
              @click="copyToClipboard" />
          </div>
        </div>
      </Dialog>

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
            {{ t('暂无分享') }}
          </p>
        </div>
      </div>

      <!-- 画廊网格 -->
      <div v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <div
            v-for="item in shareList.state.value.data"
            :key="item.id"
            class="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden">
            <ShareCard :data="(item as any)" />

            <!-- 标题和文件信息 -->
            <div class="p-4">
              <h3 class="text-lg h-8 font-semibold text-gray-900 dark:text-white truncate mb-2">
                {{ (item.data as unknown as ShareJSON).title }}
              </h3>
              <div class="flex items-center">
                <div class="flex-1"></div>
                <Button
                  icon="pi pi-qrcode"
                  class="p-button-rounded p-button-secondary p-button-text p-2 mr-1"
                  @click.stop="handleShowQRCode(item as any)"
                  :aria-label="t('显示二维码')" />
                <Button
                  icon="pi pi-link"
                  class="p-button-rounded p-button-secondary p-button-text p-2 mr-1"
                  @click.stop="handleGotoDetail(item as any)" />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-secondary p-button-text p-2 mr-1"
                  @click.stop="handleEdit(item as any)"
                  :aria-label="t('编辑')" />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-danger p-button-text p-2"
                  @click.stop="handleDelete(item as any)"
                  :aria-label="t('删除')" />
              </div>

              <div
                class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span
                  >{{ (item.data as unknown as ShareJSON).files.length }} {{ t('个文件') }}</span
                >
                <span>{{
                  formatFileSize(getTotalFileSize(item.data as unknown as ShareJSON))
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <Paginator
          :rows="shareList.params.take"
          :total-records="shareList.state.value.total"
          :first="shareList.params.skip"
          @page="onPageChange" />
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
  import { routeMap, routerUtil } from '@/router';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { useAsyncState, watchDebounced } from '@vueuse/core';
  import type { Prisma } from '@tsfullstack/backend';
  import QRCode from 'qrcode';
  import { reactive, ref } from 'vue';
  import { useConfirm, useToast } from 'primevue';
  import { useI18n } from '@/composables/useI18n';

  const { API } = useAPI();
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();

  // 搜索关键词
  const searchTitle = ref('');

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
      where,
    };
  }

  const shareList = useShareList();

  /** 对话框可见性 */
  const dialogVisible = ref(false);

  /** 正在编辑的分享项 */
  const editingItem = ref<ShareItemJSON | undefined>();

  /** QR码对话框可见性 */
  const qrDialogVisible = ref(false);

  /** 选中的分享项用于显示QR码 */
  const selectedQRItem = ref<ShareItemJSON | null>(null);

  /** 当前分享URL */
  const currentShareUrl = ref('');

  /** QR码数据URL */
  const qrCodeDataUrl = ref('');

  /**
   * 打开创建对话框
   */
  const openCreateDialog = () => {
    editingItem.value = undefined;
    dialogVisible.value = true;
  };

  /**
   * 打开编辑对话框
   * @param item 分享项
   */
  const openEditDialog = (item: ShareItemJSON) => {
    editingItem.value = item;
    dialogVisible.value = true;
  };

  /**
   * 处理操作成功
   */
  const handleSuccess = () => {
    shareList.execute();
    dialogVisible.value = false;
  };

  const onPageChange = (event: any) => {
    shareList.params.skip = event.first;
    shareList.execute();
  };

  // 编辑处理
  const handleEdit = (item: ShareItemJSON) => {
    openEditDialog(item);
  };

  /**
   * 显示分享二维码
   * @param item 分享项
   */
  const handleShowQRCode = async (item: ShareItemJSON) => {
    selectedQRItem.value = item;
    const baseUrl = window.location.origin;
    currentShareUrl.value = `${baseUrl}${routeMap.ShareDetail.path.replace(
      ':id',
      String(item.id),
    )}`;

    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(currentShareUrl.value, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      console.error('生成二维码失败:', error);
      qrCodeDataUrl.value = '';
    }

    qrDialogVisible.value = true;
  };

  /**
   * 复制分享链接到剪贴板
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentShareUrl.value);
      // 这里可以添加一个toast提示，但项目可能有自己的通知系统
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleGotoDetail = (item: ShareItemJSON) => {
    routerUtil.newBlank(routeMap.ShareDetail, {
      id: String(item.id),
    });
  };
  // 删除处理
  const handleDelete = (item: ShareItemJSON) => {
    confirm.require({
      message: '确定要删除这个分享吗？',
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: '取消',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: '删除',
        severity: 'danger',
      },
      accept: async () => {
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
          toast.add({
            severity: 'success',
            summary: '成功',
            detail: '删除分享成功',
            life: 3000,
          });
        } catch (error) {
          console.error('删除失败:', error);
          toast.add({
            severity: 'error',
            summary: '失败',
            detail: '删除分享失败：' + ((error as Error).message || '未知错误'),
            life: 3000,
          });
        }
      },
      reject: () => {
        // 用户取消操作
      }
    });
  };

  // 防抖监听搜索输入
  watchDebounced(
    searchTitle,
    (newVal) => {
      // 更新 where 条件中的 title 过滤字段
      if (newVal) {
        shareList.where.data = {
          path: 'title',
          string_contains: newVal,
        };
      } else {
        delete shareList.where.data; // 清除过滤条件
      }

      // 重置分页并刷新数据
      shareList.params.skip = 0;
      shareList.execute();
    },
    { debounce: 300 },
  );
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
