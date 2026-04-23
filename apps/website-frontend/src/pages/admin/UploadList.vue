<script setup lang="ts">
/**
 * 文件上传管理页面
 * 提供文件上传、预览、下载、删除等功能
 */
import { useAPI } from '@/api';
import { Input, InputGroup, Button, DataTable, ProgressBar } from '@/components/base';
import { Dialog, Tooltip } from '@tsfullstack/shared-frontend/components';
import { getErrorMessage } from '@/utils/error';
import { formatDate } from '@/utils/format';
import { useClipboard, useTimeoutFn } from '@vueuse/core';
import { onMounted, ref, h, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';

const { API, APIGetUrl, AppAPIGetUrl } = useAPI();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

/**
 * 文件数据类型
 */
interface FileInfo {
  id: number;
  name: string;
  type: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  path: string;
  storageType: string;
  status: string;
}

// 响应式数据
const files = ref<FileInfo[]>([]);
const loading = ref(false);
const totalRecords = ref(0);
const previewDialogVisible = ref(false);
const currentFile = ref<FileInfo | null>(null);
const previewUrl = ref('');

// 上传相关
const uploadDialogVisible = ref(false);
const selectedFiles = ref<File[]>([]);
const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadProgress = ref<{ [key: number]: number }>({});
const isUploading = ref(false);

// 搜索相关
const searchTerm = ref('');

// 文件类型图标映射
const getFileIcon = (fileType?: string) => {
  if (!fileType) return 'pi pi-file';

  if (fileType.startsWith('image/')) {
    return 'pi pi-image';
  } else if (fileType.startsWith('video/')) {
    return 'pi pi-video';
  } else if (fileType.startsWith('audio/')) {
    return 'pi pi-volume-up';
  } else if (fileType.includes('pdf')) {
    return 'pi pi-file-pdf';
  } else if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) {
    return 'pi pi-file-zip';
  } else if (fileType.includes('doc') || fileType.includes('word')) {
    return 'pi pi-file-word';
  } else if (fileType.includes('xls') || fileType.includes('excel')) {
    return 'pi pi-file-excel';
  } else if (fileType.includes('ppt') || fileType.includes('powerpoint')) {
    return 'pi pi-file-powerpoint';
  } else {
    return 'pi pi-file';
  }
};

// 判断是否为图片文件
const isImageFile = (fileType?: string) => {
  if (!fileType) return false;
  return fileType.startsWith('image/');
};

/** 格式化文件大小（从 utils/format 统一导入） */
import { formatFileSize } from '@/utils/format';

// 表格列定义
const fileColumns = computed(() => [
  {
    key: 'name',
    title: t('文件名'),
    render: (row: FileInfo) =>
      h('div', { class: 'flex items-center' }, [
        h('div', { class: 'flex items-center justify-center w-[50px] h-[50px] text-2xl mx-auto md:w-[50px] md:h-[50px] md:text-2xl max-md:w-[40px] max-md:h-[40px] max-md:text-xl max-[480px]:w-[30px] max-[480px]:h-[30px] max-[480px]:text-lg' }, [h('i', { class: getFileIcon(row.type) })]),
        h('span', { class: 'ml-2' }, row.name),
      ]),
  },
  {
    key: 'type',
    title: t('类型'),
  },
  {
    key: 'size',
    title: t('大小'),
    render: (row: FileInfo) => h('span', formatFileSize(row.size)),
  },
  {
    key: 'createdAt',
    title: t('上传时间'),
    render: (row: FileInfo) => h('span', formatDate(row.createdAt)),
  },
  {
    key: 'actions',
    title: t('操作'),
    render: (row: FileInfo) =>
      h('div', { class: 'flex gap-1' }, [
        h(Tooltip, { content: t('预览') }, () =>
          h(Button, {
            icon: 'pi pi-eye',
            onClick: () => previewFile(row),
          }),
        ),
        h(Tooltip, { content: t('下载') }, () =>
          h(Button, {
            icon: 'pi pi-download',
            onClick: () => downloadFile(row),
          }),
        ),
        h(Button, {
          icon: 'pi pi-copy',
          label: t('复制公开链接'),
          onClick: () => shareFile(row),
        }),
        h(Tooltip, { content: t('删除') }, () =>
          h(Button, {
            icon: 'pi pi-times',
            variant: 'danger',
            onClick: () => deleteFile(row),
          }),
        ),
      ]),
  },
]);

// 分页查询
const loadFiles = async (page: number = 0, pageSize: number = 10) => {
  try {
    loading.value = true;
    const skip = page * pageSize;

    let result: Array<{
      id: number;
      filename: string;
      mimetype: string;
      size: number;
      created: Date;
      updated: Date;
      path: string;
      storageType: string;
      status: string;
    }>;

    // 如果有搜索词，使用搜索API
    if (searchTerm.value.trim()) {
      result = await API.db.file.findMany({
        where: {
          filename: {
            contains: searchTerm.value,
          },
        },
        skip,
        take: pageSize,
        orderBy: {
          created: 'desc',
        },
      });

      totalRecords.value = await API.db.file.count({
        where: {
          filename: {
            contains: searchTerm.value,
          },
        },
      });
    } else {
      // 否则加载所有文件
      result = await API.db.file.findMany({
        skip,
        take: pageSize,
        orderBy: {
          created: 'desc',
        },
      });

      totalRecords.value = await API.db.file.count();
    }

    // 转换字段名以匹配前端显示
    files.value = result.map((file) => ({
      id: file.id,
      name: file.filename,
      type: file.mimetype,
      size: file.size,
      createdAt: file.created,
      updatedAt: file.updated,
      path: file.path,
      storageType: file.storageType,
      status: file.status,
    }));
  } catch (error: unknown) {
    toast.error(t('加载文件列表失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
};

// 预览文件
const previewFile = async (file: FileInfo) => {
  currentFile.value = file;
  if (isImageFile(file.type)) {
    try {
      // 构建文件预览URL
      previewUrl.value = await APIGetUrl.fileApi.file(file.id);
    } catch (error: unknown) {
      toast.error(t('获取预览链接失败'), getErrorMessage(error));
    }
  }
  previewDialogVisible.value = true;
};

// 下载文件
const downloadFile = async (file: FileInfo) => {
  try {
    window.open(await APIGetUrl.fileApi.file(file.id), '_blank', 'noopener,noreferrer');
  } catch (error: unknown) {
    toast.error(t('下载文件失败'), getErrorMessage(error));
  }
};
async function deleteFile(row: FileInfo) {
  confirm.require({
    message: t('确定要删除文件 {name} 吗？此操作不可撤销').replace('{name}', row.name),
    acceptProps: { label: t('删除'), variant: 'danger' as const },
    rejectProps: { label: t('取消') },
    accept: async () => {
      try {
        await API.fileApi.delete(row.id);
        toast.success(t('删除成功'));
        loadFiles();
      } catch (error: unknown) {
        toast.error(t('删除失败'), getErrorMessage(error));
      }
    },
  });
}
const { copy } = useClipboard();

async function shareFile(file: FileInfo) {
  copy(AppAPIGetUrl.fileApi.file(file.id));
}

// 下载当前文件
const downloadCurrentFile = () => {
  if (currentFile.value) {
    downloadFile(currentFile.value);
  }
};

// 显示上传对话框
const showUploadDialog = () => {
  uploadDialogVisible.value = true;
  selectedFiles.value = [];
  uploadProgress.value = {};
};

// 触发文件选择
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const pickedFiles = Array.from(target.files);
    selectedFiles.value = [...selectedFiles.value, ...pickedFiles];
  }
};

// 拖拽事件处理
const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (event.dataTransfer && event.dataTransfer.files.length > 0) {
    const droppedFiles = Array.from(event.dataTransfer.files);
    selectedFiles.value = [...selectedFiles.value, ...droppedFiles];
  }
};

// 上传文件
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return;

  isUploading.value = true;

  try {
    // 逐个上传文件
    for (const [i, file] of selectedFiles.value.entries()) {

      // 初始化进度
      uploadProgress.value[i] = 0;

      try {
        // 调用后端API上传文件
        if (file) {
          await API.fileApi.upload(file);
        }
        // 更新进度
        uploadProgress.value[i] = 100;

        // 重新加载文件列表
        await loadFiles();
      } catch (error: unknown) {
        toast.error(t('文件上传失败'), getErrorMessage(error));
      }
    }

    // 重置状态
    useTimeoutFn(() => {
      uploadDialogVisible.value = false;
      selectedFiles.value = [];
      uploadProgress.value = {};
      isUploading.value = false;
    }, 500);
  } catch (error: unknown) {
    toast.error(t('批量上传失败'), getErrorMessage(error));
    isUploading.value = false;
  }
};

// 搜索文件（复用 loadFiles 的分页逻辑）
const searchFiles = () => {
  if (!searchTerm.value.trim()) {
    loadFiles();
    return;
  }
  loadFiles(0, 999);
};

// 组件挂载时加载数据
onMounted(() => {
  loadFiles();
});
</script>

<template>
  <div class="p-4 max-md:p-2 max-[480px]:p-1">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold text-primary-900 dark:text-primary-100">{{ t('文件管理') }}</h1>
      <Button :label="t('上传文件')" icon="pi pi-upload" variant="primary" @click="showUploadDialog" />
    </div>

    <!-- 搜索框 -->
    <div class="mb-4">
      <InputGroup>
        <Input v-model="searchTerm" :placeholder="t('搜索文件名...')" @keyup.enter="searchFiles" />
        <Button icon="pi pi-search" @click="searchFiles" />
      </InputGroup>
    </div>

    <!-- 文件表格 -->
    <DataTable :data="files" :loading="loading" :columns="fileColumns" rowKey="id" striped bordered />

    <!-- 文件上传对话框 -->
    <Dialog v-model:open="uploadDialogVisible" :title="t('上传文件')">
      <div class="upload-dialog-content">
        <div class="border-2 border-dashed border-neutral-400 dark:border-neutral-600 rounded-lg p-8 text-center cursor-pointer transition-all duration-300 hover:border-primary-600 hover:bg-neutral-50 dark:hover:border-primary-400 dark:hover:bg-neutral-800"
          :class="{ 'border-primary-600 bg-neutral-50 dark:border-primary-400 dark:bg-neutral-800': isDragging }"
          @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
          <i class="pi pi-cloud-upload text-3xl text-primary-600 dark:text-primary-400 mb-4"></i>
          <p>{{ t('拖拽文件到此处或点击选择文件') }}</p>
          <Button :label="t('选择文件')" icon="pi pi-folder" @click="triggerFileInput" class="mt-3" />
          <input ref="fileInputRef" type="file" @change="handleFileSelect" class="hidden" multiple />
        </div>
        <div v-if="selectedFiles.length > 0" class="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
          <h3>{{ t('已选择的文件') }}</h3>
          <ul class="file-list">
            <li v-for="(file, index) in selectedFiles" :key="file.name + '-' + file.size + '-' + index"
              class="py-2 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <i :class="getFileIcon(file.type)" class="mr-2"></i>
                  <span>{{ file.name }}</span>
                </div>
                <span>{{ formatFileSize(file.size) }}</span>
              </div>
              <ProgressBar v-if="uploadProgress[index] !== undefined" :value="uploadProgress[index]" class="mt-2" />
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <Button :label="t('取消')" icon="pi pi-times" variant="text" @click="uploadDialogVisible = false" />
        <Button :label="t('上传')" icon="pi pi-upload" @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading" />
      </template>
    </Dialog>

    <!-- 文件预览对话框 -->
    <Dialog v-model:open="previewDialogVisible" :title="currentFile?.name" :description="t('预览文件内容')">
      <div class="file-preview-dialog">
        <!-- 图片文件预览 -->
        <img v-if="isImageFile(currentFile?.type)" :src="previewUrl" :alt="currentFile?.name"
          class="max-w-full max-h-[40vh] object-contain" />
        <!-- 非图片文件显示信息 -->
        <div v-else class="text-center">
          <i :class="getFileIcon(currentFile?.type)" class="text-6xl"></i>
          <p class="mt-4">{{ t('该文件类型不支持预览') }}</p>
          <p class="mt-2">{{ t('您可以下载文件以查看内容') }}</p>
        </div>
      </div>
      <template #footer>
        <Button :label="t('下载')" icon="pi pi-download" @click="downloadCurrentFile" />
        <Button :label="t('关闭')" icon="pi pi-times" variant="text" @click="previewDialogVisible = false" />
      </template>
    </Dialog>
  </div>
</template>
