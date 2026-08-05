<template>
  <div class="share-file-list flex flex-col h-full">
    <!-- 文件列表 -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="(file, index) in files"
        :key="file.id ?? index"
        class="file-item group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm"
        :class="[
          selectedFileId === (file.id ?? index)
            ? 'bg-primary-100 dark:bg-primary-800 text-primary-900 dark:text-primary-100'
            : 'hover:bg-primary-50 dark:hover:bg-primary-900 text-primary-700 dark:text-primary-300',
          isFileMarkedForDeletion(file.id) ? 'opacity-40 line-through' : '',
        ]"
        @click="selectFile(file, index)"
      >
        <i class="pi shrink-0" :class="getFileIcon(file)" />
        <input
          v-if="isEditMode"
          class="truncate flex-1 bg-transparent border-none outline-none text-sm min-w-0"
          :value="file.filename"
          @click.stop="selectFile(file, index)"
          @input="emit('rename', file, ($event.target as HTMLInputElement).value)"
        />
        <span v-else class="truncate flex-1">{{ file.filename }}</span>
        <i
          v-if="modifiedFileIds.has(file.id)"
          class="pi pi-circle text-warning-500 text-xs shrink-0"
          :title="t('未保存')"
        />
        <span v-if="file.size" class="text-xs text-primary-subtle shrink-0">
          {{ formatFileSize(file.size) }}
        </span>
        <Button
          v-if="isEditMode && file.id"
          variant="ghost"
          size="sm"
          class="shrink-0 opacity-0 group-hover:opacity-100"
          @click.stop="toggleDelete(file.id)"
        >
          <i :class="isFileMarkedForDeletion(file.id) ? 'pi pi-refresh' : 'pi pi-times'" />
        </Button>
      </div>
    </div>

    <!-- 编辑模式操作按钮 -->
    <div v-if="isEditMode" class="p-3 border-t border-primary-default space-y-2">
      <Button variant="text" size="sm" class="w-full justify-start!" @click="handleCreateTextFile">
        <i class="pi pi-file-edit mr-2" />
        {{ t("新建文本文件") }}
      </Button>
      <Button variant="text" size="sm" class="w-full justify-start!" @click="triggerUpload">
        <i class="pi pi-upload mr-2" />
        {{ t("上传文件") }}
      </Button>
      <input ref="fileInputRef" type="file" multiple class="hidden" @change="onFileSelect" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ShareFileJSON } from "@/pages/admin/share/ShareDef";
import { isTextFile, getFileTypeIcon } from "@/pages/admin/share/ShareDef";
import { formatFileSize } from "@/utils/format";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

interface Props {
  /** 文件列表 */
  files: ShareFileJSON[];
  /** 当前选中的文件 id 或 index */
  selectedFileId?: number | string;
  /** 是否编辑模式 */
  isEditMode?: boolean;
  /** 已标记删除的文件 id 集合 */
  deletedFileIds?: Set<number>;
  /** 已修改的文件 id 集合 */
  modifiedFileIds?: Set<number>;
}

const {
  files,
  selectedFileId,
  isEditMode = false,
  deletedFileIds = new Set(),
  modifiedFileIds = new Set(),
} = defineProps<Props>();

const emit = defineEmits<{
  /** 选中文件 */
  select: [file: ShareFileJSON, index: number];
  /** 创建新文本文件 */
  createTextFile: [];
  /** 上传文件 */
  uploadFiles: [files: File[]];
  /** 切换文件删除状态 */
  toggleDelete: [fileId: number];
  /** 重命名文件 */
  rename: [file: ShareFileJSON, newName: string];
}>();

const fileInputRef = ref<HTMLInputElement>();

function getFileIcon(file: ShareFileJSON): string {
  if (isTextFile(file.mimetype)) return "pi pi-file-edit";
  return getFileTypeIcon(file.mimetype);
}

function selectFile(file: ShareFileJSON, index: number) {
  emit("select", file, index);
}

function handleCreateTextFile() {
  emit("createTextFile");
}

function triggerUpload() {
  fileInputRef.value?.click();
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) {
    emit("uploadFiles", Array.from(input.files));
    input.value = "";
  }
}

function isFileMarkedForDeletion(fileId: number | undefined): boolean {
  if (fileId === undefined) return false;
  return deletedFileIds.has(fileId);
}

function toggleDelete(fileId: number | undefined) {
  if (fileId === undefined) return;
  emit("toggleDelete", fileId);
}
</script>

<style scoped>
.file-item {
  position: relative;
}
.file-item:hover :deep(.pi-times),
.file-item:hover :deep(.pi-refresh) {
  opacity: 1;
}
</style>
