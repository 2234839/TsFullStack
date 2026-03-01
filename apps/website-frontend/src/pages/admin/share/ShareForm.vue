<style scoped>
/* 仅保留一些动画效果，其他样式使用 Tailwind CSS */
</style>
<template>
  <Dialog :open="visible" @update:open="$emit('update:visible', $event)" :title="dialogTitle" :modal="true">
    <div class="flex flex-col gap-4">
      <input v-model="formData.title" type="text"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white transition-all"
        :placeholder="t('请输入标题')" />

      <!-- 文件上传区域 -->
      <div
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 bg-gray-50 dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        @click="triggerFileInput" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop">
        <input ref="fileInputRef" type="file" multiple @change="onFileSelect" class="hidden"
          :placeholder="t('请选择文件')" />
        <div class="text-primary-500 mb-4 flex justify-center">
          <i class="pi pi-cloud-upload text-5xl"></i>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('点击或拖拽文件到此处上传') }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-500">{{ t('支持多个文件同时上传') }}</div>
      </div>

      <!-- 已选择的文件列表 -->
      <div v-if="selectedFiles.length > 0">
        <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t('已选择的文件') }}</div>
        <div v-for="(file, index) in selectedFiles" :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-2 last:mb-0 hover:bg-gray-100 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
          <div class="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 min-w-0 flex-1">
            <i class="pi pi-file text-xl shrink-0 text-gray-500"></i>
            <span class="truncate flex-1">{{ file.name }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">{{ formatFileSize(file.size) }}</span>
          </div>
          <button
            class="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-danger-100 dark:hover:bg-danger-900/20 hover:text-danger-600 dark:hover:text-danger-400 transition-all"
            @click="removeSelectedFile(index)" :aria-label="t('移除文件')">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>

      <!-- 已上传的文件列表 -->
      <div v-if="uploadedFiles.length > 0">
        <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t('已上传的文件') }}</div>
        <div v-for="file in uploadedFiles" :key="file.id"
          class="flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 transition-all"
          :class="isFileMarkedForDeletion(file.id)
            ? 'bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 opacity-60'
            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'">
          <div class="flex items-center gap-3 text-sm min-w-0 flex-1" :class="isFileMarkedForDeletion(file.id)
              ? 'text-gray-500 dark:text-gray-500 line-through'
              : 'text-gray-700 dark:text-gray-300'">
            <i class="pi pi-file text-xl shrink-0" :class="isFileMarkedForDeletion(file.id)
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-500 dark:text-gray-400'"></i>
            <span class="truncate flex-1">{{ file.filename }}</span>
            <span class="text-xs shrink-0 ml-2" :class="isFileMarkedForDeletion(file.id)
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-500 dark:text-gray-400'">{{ formatFileSize(file.size || 0) }}</span>
          </div>
          <button type="button" class="px-3 py-2 rounded-md text-sm font-medium transition-all"
            :class="isFileMarkedForDeletion(file.id)
              ? 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'"
            @click="isFileMarkedForDeletion(file.id) ? undoRemoveFile(file.id) : removeUploadedFile(file.id)"
            :aria-label="isFileMarkedForDeletion(file.id) ? t('撤销删除') : t('移除文件')">
            {{ isFileMarkedForDeletion(file.id) ? t('撤销') : '' }}
            <i :class="isFileMarkedForDeletion(file.id) ? 'pi pi-refresh' : 'pi pi-times'"></i>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          @click="close">
          {{ t('取消') }}
        </button>
        <button type="button"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="submit" :disabled="isSubmitting">
          {{ isSubmitting ? t('提交中...') : t('提交') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON, ShareJSON } from '@/pages/admin/share/ShareDef';
  import type { ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import { authInfo } from '@/storage';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { $Enums } from '@tsfullstack/backend';
  import { computed, ref, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { Dialog } from '@tsfullstack/shared-frontend/components';

  const { API } = useAPI();
  const { t } = useI18n();

  /** Props */
  interface Props {
    visible: boolean;
    editingItem?: ShareItemJSON;
  }
  const props = defineProps<Props>();

  /** Emits */
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'success'): void;
  }>();

  /** 表单数据 */
  const formData = ref({
    /** 标题 */
    title: '',
  });

  /** 表单类型 */
  const formType = ref<'create' | 'update'>('create');

  /** 当前编辑的分享ID */
  const editingId = ref<number>();

  /** 选中的文件列表（尚未上传） */
  const selectedFiles = ref<File[]>([]);

  /** 已上传的文件列表 */
  const uploadedFiles = ref<ShareFileJSON[]>([]);

  /** 标记为删除的文件ID集合 */
  const deletedFileIds = ref<Set<number>>(new Set());

  /** 是否正在提交 */
  const isSubmitting = ref(false);

  /** 文件输入框引用 */
  const fileInputRef = ref<HTMLInputElement>();

  /** 对话框标题 */
  const dialogTitle = computed(() => {
    return formType.value === 'create' ? '新建分享' : '编辑分享';
  });

  /**
   * 加载编辑项数据
   */
  function loadEditingItem() {
    if (props.editingItem) {
      formType.value = 'update';
      editingId.value = props.editingItem.id;
      formData.value.title = (props.editingItem.data as ShareJSON).title;
      uploadedFiles.value = [...(props.editingItem.data as ShareJSON).files];
      selectedFiles.value = [];
    } else {
      resetForm();
    }
  }

  /**
   * 监听编辑项变化
   */
  watch(
    () => props.editingItem,
    () => {
      loadEditingItem();
    },
    { immediate: true },
  );

  /**
   * 监听对话框打开状态
   * 当对话框打开时重新加载数据
   */
  watch(
    () => props.visible,
    (isVisible) => {
      if (isVisible) {
        loadEditingItem();
      }
    },
  );

  /**
   * 触发文件输入框点击
   */
  function triggerFileInput() {
    fileInputRef.value?.click();
  }

  /**
   * 处理拖拽悬停
   */
  function handleDragOver(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    const target = event.target as HTMLElement;
    target.closest('.upload-area')?.classList.add('drag-over');
  }

  /**
   * 处理拖拽离开
   */
  function handleDragLeave(event: DragEvent) {
    const target = event.target as HTMLElement;
    target.closest('.upload-area')?.classList.remove('drag-over');
  }

  /**
   * 处理文件拖放
   */
  function handleDrop(event: DragEvent) {
    const target = event.target as HTMLElement;
    target.closest('.upload-area')?.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (files) {
      selectedFiles.value.push(...Array.from(files));
    }
  }

  /**
   * 原生文件选择处理
   * @param event 文件选择事件
   */
  function onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      selectedFiles.value.push(...files);
    }
  }

  /**
   * 格式化文件大小
   * @param bytes 文件大小（字节）
   */
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * 移除选中的文件
   * @param index 文件索引
   */
  function removeSelectedFile(index: number) {
    selectedFiles.value.splice(index, 1);
  }

  /**
   * 移除已上传的文件（软删除）
   * 注意：这里只是标记为删除状态，不会真正从列表中移除
   * 文件只有在提交时才会真正被删除
   * @param fileId 文件ID
   */
  function removeUploadedFile(fileId: number) {
    deletedFileIds.value.add(fileId);
  }

  /**
   * 撤销删除已上传的文件
   * @param fileId 文件ID
   */
  function undoRemoveFile(fileId: number) {
    deletedFileIds.value.delete(fileId);
  }

  /**
   * 检查文件是否已被标记为删除
   * @param fileId 文件ID
   */
  function isFileMarkedForDeletion(fileId: number): boolean {
    return deletedFileIds.value.has(fileId);
  }

  /**
   * 提交表单
   */
  async function submit() {
    isSubmitting.value = true;
    try {
      // 并发执行上传和删除操作
      const uploadPromises = selectedFiles.value.map(async (file) => {
        const { id } = await API.fileApi.upload(file);
        const result = await API.fileApi.updateFileStatus(id, $Enums.FileStatusEnum.public);
        // 将 Date 对象转换为 ISO 字符串以便存储到 JSON 字段
        return {
          ...result,
          created: result.created.toISOString(),
          updated: result.updated.toISOString(),
        };
      });

      const deletePromises = Array.from(deletedFileIds.value).map(
        (fileId) => API.fileApi.delete(fileId)
      );

      const [uploadedResults] = await Promise.all([
        Promise.all(uploadPromises),
        Promise.all(deletePromises),
      ]);

      uploadedFiles.value.push(...uploadedResults);

      // 清空选中的文件
      selectedFiles.value = [];

      // 从列表中移除已删除的文件
      uploadedFiles.value = uploadedFiles.value.filter(
        (file) => !deletedFileIds.value.has(file.id)
      );

      // 清空删除标记
      deletedFileIds.value.clear();

      if (formType.value === 'create') {
        // 创建用户数据
        const result = await API.db.userData.create({
          data: {
            appId: userDataAppid.shareInfo,
            userId: authInfo.value.userId,
            key: crypto.randomUUID(),
            data: {
              title: formData.value.title,
              files: uploadedFiles.value,
            }  as any
          },
        });

        // 创建成功后切换到编辑模式
        formType.value = 'update';
        editingId.value = result.id;
      } else if (formType.value === 'update' && editingId.value) {
        // 更新用户数据
        await API.db.userData.update({
          where: { id: editingId.value },
          data: {
            data: {
              title: formData.value.title,
              files: uploadedFiles.value,
            } as any
          },
        });
      }

      // 通知成功，但不关闭对话框
      emit('success');
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * 关闭对话框
   */
  function close() {
    emit('update:visible', false);
  }

  /**
   * 重置表单
   */
  function resetForm() {
    formData.value.title = '';
    selectedFiles.value = [];
    uploadedFiles.value = [];
    deletedFileIds.value.clear();
    formType.value = 'create';
    editingId.value = undefined;
  }
</script>
