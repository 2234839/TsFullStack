<style scoped>
/* 仅保留一些动画效果，其他样式使用 Tailwind CSS */
</style>
<template>
  <Dialog v-model:open="localVisible" :title="dialogTitle">
    <div class="flex flex-col gap-4">
      <Input v-model="formData.title" :placeholder="t('请输入标题')" />

      <!-- 文件上传区域 -->
      <div
        class="upload-area border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 bg-primary-50 dark:bg-primary-800 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        @click="triggerFileInput" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop">
        <input ref="fileInputRef" type="file" multiple @change="onFileSelect" class="hidden"
          :placeholder="t('请选择文件')" />
        <div class="text-primary-500 dark:text-primary-400 mb-4 flex justify-center">
          <i class="pi pi-cloud-upload text-5xl"></i>
        </div>
        <div class="text-sm text-primary-600 dark:text-primary-400 mb-1">{{ t('点击或拖拽文件到此处上传') }}</div>
        <div class="text-xs text-primary-500 dark:text-primary-500">{{ t('支持多个文件同时上传') }}</div>
      </div>

      <!-- 已选择的文件列表 -->
      <div v-if="selectedFiles.length > 0">
        <div class="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-3">{{ t('已选择的文件') }}</div>
        <div v-for="(file, index) in selectedFiles" :key="`${file.name}-${file.size}-${index}`"
          class="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-800 border border-primary-200 dark:border-primary-700 rounded-lg mb-2 last:mb-0 hover:bg-primary-100 dark:hover:bg-primary-750 hover:border-primary-300 dark:hover:border-primary-600 transition-all">
          <div class="flex items-center gap-3 text-sm text-primary-700 dark:text-primary-300 min-w-0 flex-1">
            <i class="pi pi-file text-xl shrink-0 text-primary-500 dark:text-primary-400"></i>
            <span class="truncate flex-1">{{ file.name }}</span>
            <span class="text-xs text-primary-500 dark:text-primary-400 shrink-0 ml-2">{{ formatFileSize(file.size) }}</span>
          </div>
          <Button
            variant="ghost" size="sm"
            class="text-primary-500 dark:text-primary-400 hover:bg-danger-100 dark:hover:bg-danger-900/20 hover:text-danger-600! dark:hover:text-danger-400!"
            @click="removeSelectedFile(index)" :aria-label="t('移除文件')">
            <i class="pi pi-times"></i>
          </Button>
        </div>
      </div>

      <!-- 已上传的文件列表 -->
      <div v-if="uploadedFiles.length > 0">
        <div class="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-3">{{ t('已上传的文件') }}</div>
        <div v-for="file in uploadedFiles" :key="file.id"
          class="flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 transition-all"
          :class="isFileMarkedForDeletion(file.id)
            ? 'bg-primary-100 dark:bg-primary-900 border border-primary-300 dark:border-primary-600 opacity-60'
            : 'bg-primary-50 dark:bg-primary-800 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-700 hover:border-primary-300 dark:hover:border-primary-600'">
          <div class="flex items-center gap-3 text-sm min-w-0 flex-1" :class="isFileMarkedForDeletion(file.id)
              ? 'text-primary-500 dark:text-primary-500 line-through'
              : 'text-primary-700 dark:text-primary-300'">
            <i class="pi pi-file text-xl shrink-0" :class="isFileMarkedForDeletion(file.id)
                ? 'text-primary-400 dark:text-primary-600'
                : 'text-primary-500 dark:text-primary-400'"></i>
            <span class="truncate flex-1">{{ file.filename }}</span>
            <span class="text-xs shrink-0 ml-2" :class="isFileMarkedForDeletion(file.id)
                ? 'text-primary-400 dark:text-primary-600'
                : 'text-primary-500 dark:text-primary-400'">{{ formatFileSize(file.size ?? 0) }}</span>
          </div>
          <Button type="button" variant="ghost" size="sm"
            :class="isFileMarkedForDeletion(file.id)
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-primary-500 dark:text-primary-400'"
            @click="isFileMarkedForDeletion(file.id) ? undoRemoveFile(file.id) : removeUploadedFile(file.id)"
            :aria-label="isFileMarkedForDeletion(file.id) ? t('撤销删除') : t('移除文件')">
            {{ isFileMarkedForDeletion(file.id) ? t('撤销') : '' }}
            <i :class="isFileMarkedForDeletion(file.id) ? 'pi pi-refresh' : 'pi pi-times'"></i>
          </Button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="close">
          {{ t('取消') }}
        </Button>
        <Button :disabled="isSubmitting" :loading="isSubmitting" @click="submit">
          {{ isSubmitting ? t('提交中...') : t('提交') }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON, ShareItemJSON, ShareJSON } from '@/pages/admin/share/ShareDef';
  import { authInfo } from '@/storage';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { $Enums } from '@tsfullstack/backend';
  import { computed, ref, shallowRef, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { useToast } from '@/composables/useToast';
  import { getErrorMessage } from '@/utils/error';
  import { Dialog } from '@tsfullstack/shared-frontend/components';
  import { formatFileSize } from '@/utils/format';
  import { toJsonValue } from '@/utils/apiType';

  const { API } = useAPI();
  const { t } = useI18n();
  const toast = useToast();

  /** Props */
  interface Props {
    open: boolean;
    editingItem?: ShareItemJSON;
  }
  const { open, editingItem } = defineProps<Props>();

  /** Emits */
  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'success'): void;
  }>();

  /** 本地的 open 状态，支持双向绑定 */
  const localVisible = computed<boolean>({
    get: () => open,
    set: (value: boolean) => emit('update:open', value),
  });

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
  const uploadedFiles = shallowRef<ShareFileJSON[]>([]);

  /** 标记为删除的文件ID集合 */
  const deletedFileIds = ref<Set<number>>(new Set());

  /** 是否正在提交 */
  const isSubmitting = ref(false);

  /** 文件输入框引用 */
  const fileInputRef = ref<HTMLInputElement>();

  /** 对话框标题 */
  const dialogTitle = computed(() => {
    return formType.value === 'create' ? t('新建分享') : t('编辑分享');
  });

  /**
   * 加载编辑项数据
   */
  function loadEditingItem() {
    if (editingItem) {
      formType.value = 'update';
      editingId.value = editingItem.id;
      formData.value.title = (editingItem.data as ShareJSON).title;
      uploadedFiles.value = [...((editingItem.data as ShareJSON)?.files ?? [])];
      selectedFiles.value = [];
    } else {
      resetForm();
    }
  }

  /**
   * 监听编辑项变化
   */
  watch(
    () => editingItem,
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
    () => open,
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

      uploadedFiles.value = [...uploadedFiles.value, ...uploadedResults];

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
        const created = await API.db.userData.create({
          data: {
            appId: userDataAppid.shareInfo,
            userId: authInfo.value.userId,
            key: crypto.randomUUID(),
            data: toJsonValue(JSON.stringify({
              title: formData.value.title,
              files: uploadedFiles.value,
            })),
          },
        });
        /** 创建成功后切换为编辑模式，后续提交走更新逻辑 */
        editingId.value = created.id;
        formType.value = 'update';
      } else if (editingId.value !== undefined) {
        // 更新现有分享数据
        await API.db.userData.update({
          where: { id: editingId.value },
          data: {
            data: toJsonValue(JSON.stringify({
              title: formData.value.title,
              files: uploadedFiles.value,
            })),
          },
        });
      }

      // 通知成功，但不关闭对话框
      emit('success');
    } catch (error: unknown) {
      toast.error(t('保存失败'), getErrorMessage(error, t('保存分享信息时发生错误')));
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * 关闭对话框
   */
  function close() {
    emit('update:open', false);
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
