<style scoped>
  .upload-list-container {
    padding: 1rem;
  }

  .upload-area {
    border: 2px dashed var(--surface-400);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
  }

  .upload-area:hover,
  .upload-area.drag-over {
    border-color: var(--primary-500);
    background-color: var(--surface-100);
  }

  .upload-icon {
    font-size: 3rem;
    color: var(--primary-500);
    margin-bottom: 1rem;
  }

  .selected-files {
    border-top: 1px solid var(--surface-300);
    padding-top: 1rem;
  }

  .file-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--surface-200);
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .file-preview-dialog :deep(.p-dialog-content) {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    min-height: 300px;
  }

  .file-preview-image {
    max-width: 100%;
    max-height: 70vh;
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

  .file-table :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
  }

  .file-table :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--surface-200);
  }

  .file-table :deep(.p-datatable-tbody > tr:hover td) {
    background-color: transparent;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .upload-list-container {
      padding: 0.5rem;
    }

    .page-title {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .file-preview-dialog :deep(.p-dialog-content) {
      padding: 1rem;
    }

    .file-icon {
      font-size: 1.5rem;
      width: 40px;
      height: 40px;
    }

    :deep(.p-datatable) {
      font-size: 0.875rem;
    }

    :deep(.p-datatable .p-datatable-header) {
      padding: 0.5rem;
    }

    :deep(.p-datatable .p-datatable-tbody > tr > td) {
      padding: 0.5rem;
    }
  }

  @media (max-width: 480px) {
    .upload-list-container {
      padding: 0.25rem;
    }

    .page-title {
      font-size: 1.125rem;
      margin-bottom: 0.5rem;
    }

    .file-icon {
      font-size: 1.25rem;
      width: 30px;
      height: 30px;
    }

    :deep(.p-datatable .p-datatable-tbody > tr > td) {
      padding: 0.25rem;
    }

    :deep(.p-button) {
      width: 2rem;
      height: 2rem;
      padding: 0.25rem;
    }
  }
</style>

<template>
  <div class="upload-list-container">
    <div class="flex justify-between items-center mb-4">
      <h1 class="page-title">{{ $t('文件管理') }}</h1>
      <Button
        :label="$t('上传文件')"
        icon="pi pi-upload"
        @click="showUploadDialog"
        class="p-button-primary" />
    </div>

    <!-- 搜索框 -->
    <div class="mb-4">
      <div class="p-inputgroup">
        <InputText
          v-model="searchTerm"
          :placeholder="$t('搜索文件名...')"
          @keyup.enter="searchFiles" />
        <Button icon="pi pi-search" @click="searchFiles" />
      </div>
    </div>

    <!-- 文件表格 -->
    <DataTable
      :value="files"
      :paginator="true"
      :rows="10"
      :loading="loading"
      v-model:first="first"
      :totalRecords="totalRecords"
      :lazy="true"
      @page="onPage"
      class="file-table"
      stripedRows
      responsiveLayout="scroll">
      <Column field="name" :header="$t('文件名')" sortable>
        <template #body="slotProps">
          <div class="flex items-center">
            <div class="file-icon">
              <i :class="getFileIcon(slotProps.data.type)"></i>
            </div>
            <span class="ml-2">{{ slotProps.data.name }}</span>
          </div>
        </template>
      </Column>
      <Column field="type" :header="$t('类型')" sortable></Column>
      <Column field="size" :header="$t('大小')" sortable>
        <template #body="slotProps">
          {{ formatFileSize(slotProps.data.size) }}
        </template>
      </Column>
      <Column field="createdAt" :header="$t('上传时间')" sortable>
        <template #body="slotProps">
          {{ formatDate(slotProps.data.createdAt) }}
        </template>
      </Column>
      <Column :header="$t('操作')">
        <template #body="slotProps">
          <Button
            icon="pi pi-eye"
            class="p-button-rounded p-button-text"
            @click="previewFile(slotProps.data)"
            v-tooltip="$t('预览')" />
          <Button
            icon="pi pi-download"
            class="p-button-rounded p-button-text ml-2"
            @click="downloadFile(slotProps.data)"
            v-tooltip="$t('下载')" />
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text ml-2"
            @click="deleteFile(slotProps.data)"
            v-tooltip="$t('删除')" />
        </template>
      </Column>
    </DataTable>

    <!-- 文件上传对话框 -->
    <Dialog
      v-model:visible="uploadDialogVisible"
      :header="$t('上传文件')"
      :modal="true"
      :style="{ width: '50vw' }"
      :breakpoints="{ '960px': '75vw', '641px': '95vw' }"
      :draggable="false">
      <div class="upload-dialog-content">
        <div
          class="upload-area"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          :class="{ 'drag-over': isDragging }">
          <i class="pi pi-cloud-upload upload-icon"></i>
          <p>{{ $t('拖拽文件到此处或点击选择文件') }}</p>
          <Button
            :label="$t('选择文件')"
            icon="pi pi-folder"
            @click="triggerFileInput"
            class="mt-3" />
          <input
            ref="fileInputRef"
            type="file"
            @change="handleFileSelect"
            class="hidden"
            multiple />
        </div>
        <div v-if="selectedFiles.length > 0" class="selected-files mt-4">
          <h3>{{ $t('已选择的文件') }}</h3>
          <ul class="file-list">
            <li v-for="(file, index) in selectedFiles" :key="index" class="file-item">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <i :class="getFileIcon(file.type)" class="mr-2"></i>
                  <span>{{ file.name }}</span>
                </div>
                <span>{{ formatFileSize(file.size) }}</span>
              </div>
              <ProgressBar
                v-if="uploadProgress[index] !== undefined"
                :value="uploadProgress[index]"
                class="mt-2" />
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <Button
          :label="$t('取消')"
          icon="pi pi-times"
          @click="uploadDialogVisible = false"
          class="p-button-text" />
        <Button
          :label="$t('上传')"
          icon="pi pi-upload"
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading" />
      </template>
    </Dialog>

    <!-- 文件预览对话框 -->
    <Dialog
      v-model:visible="previewDialogVisible"
      :header="currentFile?.name"
      :modal="true"
      :style="{ width: '70vw' }"
      :breakpoints="{ '960px': '75vw', '641px': '95vw' }"
      :draggable="false"
      :maximizable="true">
      <div class="file-preview-dialog">
        <!-- 图片文件预览 -->
        <img
          v-if="isImageFile(currentFile?.type)"
          :src="previewUrl"
          :alt="currentFile?.name"
          class="file-preview-image" />
        <!-- 非图片文件显示信息 -->
        <div v-else class="text-center">
          <i :class="getFileIcon(currentFile?.type)" style="font-size: 4rem"></i>
          <p class="mt-4">{{ $t('该文件类型不支持预览') }}</p>
          <p class="mt-2">{{ $t('您可以下载文件以查看内容') }}</p>
        </div>
      </div>
      <template #footer>
        <Button :label="$t('下载')" icon="pi pi-download" @click="downloadCurrentFile" />
        <Button
          :label="$t('关闭')"
          icon="pi pi-times"
          @click="previewDialogVisible = false"
          class="p-button-text" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import { onMounted, ref } from 'vue';

  const { API, APIGetUrl } = useAPI();

  // 响应式数据
  const files = ref<any[]>([]);
  const loading = ref(false);
  const first = ref(0);
  const totalRecords = ref(0);
  const previewDialogVisible = ref(false);
  const currentFile = ref<any>(null);
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
  const getFileIcon = (fileType: string) => {
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
  const isImageFile = (fileType: string) => {
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
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  // 分页查询
  const loadFiles = async (page: number = 0, pageSize: number = 10) => {
    try {
      loading.value = true;
      const skip = page * pageSize;

      // 如果有搜索词，使用搜索API
      if (searchTerm.value.trim()) {
        const result = await API.db.file.findMany({
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

        totalRecords.value = await API.db.file.count({
          where: {
            filename: {
              contains: searchTerm.value,
            },
          },
        });
      } else {
        // 否则加载所有文件
        const result = await API.db.file.findMany({
          skip,
          take: pageSize,
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

        totalRecords.value = await API.db.file.count();
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      loading.value = false;
    }
  };

  // 分页事件处理
  const onPage = (event: any) => {
    first.value = event.first;
    const page = event.page;
    loadFiles(page, event.rows);
  };

  // 预览文件
  const previewFile = async (file: any) => {
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
  const downloadFile = async (file: any) => {
    try {
      window.open(await APIGetUrl.fileApi.file(file.id), '_blank');
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };
  async function deleteFile(row: any) {
    await API.fileApi.delete(row.id);
    loadFiles();
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
          await API.fileApi.upload(file);
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
