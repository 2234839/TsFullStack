<script setup lang="ts">
/**
 * 文件上传管理页面
 * 提供文件上传、预览、下载、删除等功能
 */
import { useAPI } from '@/api';
import { Input, InputGroup, Button, DataTable, ProgressBar } from '@/components/base';
import { Dialog, Tooltip } from '@tsfullstack/shared-frontend/components';
import { useClipboard } from '@vueuse/core';
import { onMounted, ref, h, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { API, APIGetUrl, AppAPIGetUrl } = useAPI();
const { t } = useI18n();

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

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化日期
const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString();
};

// 表格列定义
const fileColumns = computed(() => [
  {
    key: 'name',
    title: t('文件名'),
    render: (row: FileInfo) =>
      h('div', { class: 'flex items-center' }, [
        h('div', { class: 'file-icon' }, [h('i', { class: getFileIcon(row.type) })]),
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
  } catch (error) {
    console.error('Failed to load files:', error);
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
    } catch (error) {
      console.error('Failed to get preview URL:', error);
    }
  }
  previewDialogVisible.value = true;
};

// 下载文件
const downloadFile = async (file: FileInfo) => {
  try {
    window.open(await APIGetUrl.fileApi.file(file.id), '_blank');
  } catch (error) {
    console.error('Failed to download file:', error);
  }
};
async function deleteFile(row: FileInfo) {
  await API.fileApi.delete(row.id);
  loadFiles();
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
    const files = Array.from(target.files);
    selectedFiles.value = [...selectedFiles.value, ...files];
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
    const files = Array.from(event.dataTransfer.files);
    selectedFiles.value = [...selectedFiles.value, ...files];
  }
};

// 上传文件
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return;

  isUploading.value = true;

  try {
    // 逐个上传文件
    for (let i = 0; i < selectedFiles.value.length; i++) {
      const file = selectedFiles.value[i];

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
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    // 重置状态
    setTimeout(() => {
      uploadDialogVisible.value = false;
      selectedFiles.value = [];
      uploadProgress.value = {};
      isUploading.value = false;
    }, 500);
  } catch (error) {
    console.error('Upload failed:', error);
    isUploading.value = false;
  }
};

// 搜索文件
const searchFiles = async () => {
  try {
    loading.value = true;

    // 如果搜索词为空，则加载所有文件
    if (!searchTerm.value.trim()) {
      await loadFiles();
      return;
    }

    // 调用后端API搜索文件
    const result = await API.db.file.findMany({
      where: {
        filename: {
          contains: searchTerm.value,
        },
      },
      orderBy: {
        created: 'desc',
      },
    });

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

    totalRecords.value = result.length;
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    loading.value = false;
  }
};

// 组件挂载时加载数据
onMounted(() => {
  loadFiles();
});
</script>

<template>
  <div class="upload-list-container p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ t('文件管理') }}</h1>
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
        <div class="upload-area" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop"
          :class="{ 'drag-over': isDragging }">
          <i class="pi pi-cloud-upload upload-icon"></i>
          <p>{{ t('拖拽文件到此处或点击选择文件') }}</p>
          <Button :label="t('选择文件')" icon="pi pi-folder" @click="triggerFileInput" class="mt-3" />
          <input ref="fileInputRef" type="file" @change="handleFileSelect" class="hidden" multiple />
        </div>
        <div v-if="selectedFiles.length > 0" class="selected-files mt-4">
          <h3>{{ t('已选择的文件') }}</h3>
          <ul class="file-list">
            <li v-for="(file, index) in selectedFiles" :key="index" class="file-item">
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
          class="file-preview-image" />
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

<style scoped>
.upload-list-container {
  padding: 1rem;
}

.upload-area {
  border: 2px dashed #9ca3af;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #0891b2;
  background-color: #f3f4f6;
}

.dark .upload-area {
  border-color: #4b5563;
}

.dark .upload-area:hover,
.dark .upload-area.drag-over {
  border-color: #22d3ee;
  background-color: #1f2937;
}

.upload-icon {
  font-size: 3rem;
  color: #0891b2;
  margin-bottom: 1rem;
}

.dark .upload-icon {
  color: #22d3ee;
}

.selected-files {
  border-top: 1px solid #d1d5db;
  padding-top: 1rem;
}

.dark .selected-files {
  border-top-color: #374151;
}

.file-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.dark .file-item {
  border-bottom-color: #374151;
}

.file-item:last-child {
  border-bottom: none;
}

.file-preview-image {
  max-width: 100%;
  max-height: 40vh;
  object-fit: contain;
}

.file-icon {
  font-size: 2rem;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .upload-list-container {
    padding: 0.5rem;
  }

  .file-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
  }
}

@media (max-width: 480px) {
  .upload-list-container {
    padding: 0.25rem;
  }

  .file-icon {
    font-size: 1.25rem;
    width: 30px;
    height: 30px;
  }
}
</style>
