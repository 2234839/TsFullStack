<template>
  <div class="share-editor min-h-screen bg-primary-card flex flex-col">
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-screen">
      <ProgressSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-danger-100 dark:bg-danger-900/20 rounded-full mb-4">
        <i class="pi pi-exclamation-triangle text-2xl text-danger-600 dark:text-danger-400" />
      </div>
      <h2 class="text-2xl font-semibold text-primary-title mb-2">{{ t('加载失败') }}</h2>
      <p class="text-primary-subtle">{{ t('无法加载分享内容') }}</p>
    </div>

    <!-- 主内容 -->
    <template v-else-if="shareData">
      <!-- 顶部栏 -->
      <header class="flex items-center gap-3 px-4 py-3 border-b border-primary-default bg-primary-panel shrink-0">
        <!-- 编辑模式：可编辑标题 -->
        <template v-if="isEditMode">
          <Input v-model="title" class="flex-1" :placeholder="t('分享标题')" />
          <span v-if="hasUnsavedChanges" class="text-xs text-warning-500 dark:text-warning-400 whitespace-nowrap">
            <i class="pi pi-exclamation-circle mr-1" />
            {{ t('未保存') }}
          </span>
          <Button :loading="isSaving" :disabled="isSaving" @click="save">
            <i class="pi pi-save mr-1" />
            {{ t('保存') }}
          </Button>
        </template>
        <!-- 查看模式：显示标题 -->
        <template v-else>
          <h1 class="text-xl font-bold text-primary-title flex-1 truncate">
            {{ shareData.data.title }}
          </h1>
          <Button v-if="isOwner" variant="secondary" size="sm" @click="enterEditMode">
            <i class="pi pi-pencil mr-1" />
            {{ t('编辑') }}
          </Button>
        </template>
        <Button variant="icon" @click="qrDialogVisible = true" :title="t('分享二维码')">
          <i class="pi pi-qrcode" />
        </Button>
      </header>

      <!-- 二维码对话框 -->
      <ShareQRDialog
        v-model:open="qrDialogVisible"
        :share-url="shareUrl"
        :title="shareData.data.title" />

      <!-- 主体：侧边栏 + 内容区 -->
      <div class="flex flex-1 overflow-hidden">
        <!-- 文件列表侧边栏 -->
        <aside
          class="w-56 shrink-0 border-r border-primary-default bg-primary-panel overflow-hidden flex flex-col"
          :class="{ 'hidden sm:flex': !isEditMode && !selectedFile }">
          <ShareFileList
            :files="shareData.data.files"
            :selected-file-id="selectedFileId"
            :is-edit-mode="isEditMode"
            :deleted-file-ids="editState.deletedFileIds"
            :modified-file-ids="modifiedFileIds"
            @select="handleFileSelect"
            @create-text-file="createTextFile"
            @upload-files="handleUploadFiles"
            @toggle-delete="toggleDeleteFile"
            @rename="handleFileRename" />
        </aside>

        <!-- 移动端文件选择（非编辑模式） -->
        <div v-if="!isEditMode && !selectedFile" class="flex-1 sm:hidden">
          <div class="p-4">
            <div v-for="(file, index) in shareData.data.files" :key="file.id ?? index"
              class="flex items-center gap-3 p-3 rounded-lg border border-primary-default mb-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900"
              @click="handleFileSelect(file, index)">
              <i class="pi" :class="isTextFile(file.mimetype) ? 'pi-file-edit' : getFileTypeIcon(file.mimetype)" />
              <span class="truncate">{{ file.filename }}</span>
            </div>
          </div>
        </div>

        <!-- 内容区 -->
        <main v-if="selectedFile" class="flex-1 flex flex-col overflow-hidden">
          <!-- 文件标签栏 -->
          <div class="flex items-center px-4 py-2 border-b border-primary-default bg-primary-panel text-sm">
            <i class="pi mr-2" :class="isTextFile(selectedFile.mimetype) ? 'pi-file-edit' : getFileTypeIcon(selectedFile.mimetype)" />
            <template v-if="isEditMode">
              <input
                class="truncate flex-1 bg-transparent border-none outline-none text-sm min-w-0"
                :value="selectedFile.filename"
                @input="handleRenameFile(($event.target as HTMLInputElement).value)"
              />
            </template>
            <span v-else class="truncate">{{ selectedFile.filename }}</span>
            <i v-if="isEditMode && isFileModified(selectedFile)" class="pi pi-circle text-warning-500 text-xs ml-1" :title="t('未保存')" />
            <div class="flex-1" />
            <!-- 编辑模式：替换文件按钮 -->
            <template v-if="isEditMode && selectedFile.id !== undefined && selectedFile.id > 0">
              <Button variant="ghost" size="sm" @click="triggerReplaceFile">
                <i class="pi pi-upload mr-1" />
                {{ t('替换文件') }}
              </Button>
              <input ref="replaceFileInputRef" type="file" class="hidden" @change="onReplaceFileSelected" />
            </template>
            <!-- 查看模式的操作按钮 -->
            <template v-if="!isEditMode">
              <Button variant="ghost" size="sm" @click="openInNewTab(selectedFile)">
                <i class="pi pi-external-link" />
              </Button>
              <Button variant="ghost" size="sm" @click="downloadFile(selectedFile)">
                <i class="pi pi-download" />
              </Button>
            </template>
          </div>

          <!-- 文件内容区 -->
          <div class="flex-1 overflow-hidden">
            <!-- 文本文件：编辑或查看 -->
            <template v-if="isTextFile(selectedFile.mimetype)">
              <!-- 文本内容加载中 -->
              <div v-if="textContentLoading" class="flex justify-center items-center h-full">
                <ProgressSpinner />
              </div>
              <!-- 编辑模式 -->
              <ShareCodeMirror
                v-else-if="isEditMode"
                :content="currentTextContent"
                :filename="selectedFile.filename"
                @update:content="handleTextContentChange" />
              <!-- 查看模式 -->
              <ShareCodeMirror
                v-else
                :content="currentTextContent"
                :filename="selectedFile.filename"
                read-only />
            </template>

            <!-- 二进制文件：预览 -->
            <ShareFilePreview v-else :file="selectedFile" />
          </div>
        </main>

        <!-- 无文件选中 -->
        <div v-else class="flex-1 flex items-center justify-center text-primary-subtle">
          <div class="text-center">
            <i class="pi pi-file text-4xl mb-2" />
            <p>{{ t('选择一个文件查看') }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON } from '@/pages/admin/share/ShareDef';
  import { isTextFile, getFileTypeIcon, guessMimetype, parseShareItem } from '@/pages/admin/share/ShareDef';
  import ShareFileList from '@/pages/share/ShareFileList.vue';
  import ShareCodeMirror from '@/pages/share/ShareCodeMirror.vue';
  import ShareQRDialog from '@/pages/share/ShareQRDialog.vue';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';
  import { authInfo, authInfo_isLogin } from '@/storage';
  import { useAsyncState } from '@vueuse/core';
  import { useFileUpload } from '@/composables/useFileUpload';
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
  import { onBeforeRouteLeave, useRoute } from 'vue-router';
  import { useI18n } from '@/composables/useI18n';
  import { useToast } from '@/composables/useToast';
  import { toJsonValue } from '@/utils/apiType';

  const { API, AppAPI, AppAPIGetUrl, APIGetUrl } = useAPI();
  const route = useRoute();
  const { t } = useI18n();
  const toast = useToast();
  const { uploadPublic, overwriteUpload } = useFileUpload();
  const { id } = defineProps<{ id: string }>();

  /** 二维码对话框 */
  const qrDialogVisible = ref(false);

  /** 分享链接 */
  const shareUrl = computed(() => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/ShareDetail/${id}`;
  });

  // ──────────────── 模式判断 ────────────────

  /** 加载分享数据 */
  const loadShareDetail = async () => {
    const raw = await AppAPI.shareApi.detail(Number(id));
    return parseShareItem(raw);
  };

  const { state: shareData, isLoading, error } = useAsyncState(loadShareDetail, undefined);

  /** 是否为分享所有者 */
  const isOwner = computed(() =>
    authInfo_isLogin.value && shareData.value?.userId === authInfo.value?.userId,
  );

  /** 是否编辑模式 */
  const isEditMode = computed(() =>
    isOwner.value && route.query.mode === 'edit',
  );

  // ──────────────── 文件选择 ────────────────

  const selectedFile = ref<ShareFileJSON>();
  const selectedFileId = computed(() => {
    if (!selectedFile.value) return undefined;
    return selectedFile.value.id ?? shareData.value?.data.files.indexOf(selectedFile.value);
  });

  function handleFileSelect(file: ShareFileJSON, _index: number) {
    selectedFile.value = file;
    if (isTextFile(file.mimetype) && file.id) {
      loadTextContent(file.id);
    }
  }

  // ──────────────── 文本内容管理 ────────────────

  /** 文本文件原始内容（从服务器加载），fileId -> content */
  const originalTexts = reactive<Record<number, string>>({});

  /** 文本文件当前内容（编辑中会实时更新），fileId -> content */
  const currentTexts = reactive<Record<number, string>>({});

  const textContentLoading = ref(false);

  /** 当前选中文本文件的内容 */
  const currentTextContent = computed(() => {
    if (selectedFile.value?.id === undefined) return '';
    return currentTexts[selectedFile.value.id] ?? '';
  });

  /** 判断文本文件是否有未保存修改 */
  function isTextModified(fileId: number): boolean {
    const original = originalTexts[fileId];
    const current = currentTexts[fileId];
    if (original === undefined && current === undefined) return false;
    return original !== current;
  }

  /** 获取所有有文本内容修改的文件 id */
  function getModifiedTextFileIds(): number[] {
    return Object.keys(currentTexts)
      .map(Number)
      .filter(id => isTextModified(id));
  }

  /** 从服务器加载文本文件内容 */
  async function loadTextContent(fileId: number) {
    if (fileId in originalTexts) return;
    textContentLoading.value = true;
    try {
      const url = authInfo_isLogin.value
        ? await APIGetUrl.fileApi.file(fileId)
        : await AppAPIGetUrl.fileApi.file(fileId);
      const response = await fetch(url);
      const text = await response.text();
      originalTexts[fileId] = text;
      currentTexts[fileId] = text;
    } catch {
      toast.error(t('加载失败'), t('无法加载文件内容'));
    } finally {
      textContentLoading.value = false;
    }
  }

  /** 编辑模式下文本内容变更 */
  function handleTextContentChange(newContent: string) {
    if (selectedFile.value?.id === undefined) return;
    currentTexts[selectedFile.value.id] = newContent;
  }

  // ──────────────── 标题 ────────────────

  const title = ref('');

  watch(shareData, (data) => {
    if (data) {
      title.value = data.data.title;
      /** 自动选中第一个文件 */
      if (data.data.files.length > 0 && !selectedFile.value) {
        handleFileSelect(data.data.files[0], 0);
      }
    }
  });

  // ──────────────── 编辑状态 ────────────────

  const isSaving = ref(false);
  let newTextIdCounter = -1;

  /** 统一编辑状态 */
  const editState = reactive({
    /** 已删除的文件 id */
    deletedFileIds: new Set<number>(),
    /** 已重命名的文件 id */
    renamedFileIds: new Set<number>(),
    /** 待上传的二进制文件 */
    pendingUploads: [] as File[],
    /** 新建的文本文件 tempId -> { filename, content } */
    newTextFiles: new Map<number, { filename: string; content: string }>(),
  });

  /** 重置编辑状态 */
  function resetEditState() {
    editState.deletedFileIds.clear();
    editState.renamedFileIds.clear();
    editState.pendingUploads.length = 0;
    editState.newTextFiles.clear();
    Object.keys(originalTexts).forEach(k => delete originalTexts[Number(k)]);
    Object.keys(currentTexts).forEach(k => delete currentTexts[Number(k)]);
  }

  /** 是否有未保存的修改 */
  const hasUnsavedChanges = computed(() => {
    if (!isEditMode.value || !shareData.value) return false;
    return (
      title.value !== shareData.value.data.title
      || getModifiedTextFileIds().length > 0
      || editState.newTextFiles.size > 0
      || editState.pendingUploads.length > 0
      || editState.deletedFileIds.size > 0
      || editState.renamedFileIds.size > 0
    );
  });

  /** 路由离开拦截 */
  onBeforeRouteLeave(() => {
    if (hasUnsavedChanges.value) {
      const confirmed = window.confirm(t('有未保存的修改，确定离开吗？'));
      if (!confirmed) return false;
    }
  });

  /** 刷新/关闭浏览器拦截 */
  function beforeUnloadHandler(e: BeforeUnloadEvent) {
    if (hasUnsavedChanges.value) e.preventDefault();
  }

  onMounted(() => window.addEventListener('beforeunload', beforeUnloadHandler));
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadHandler));

  /** 重命名文件（标签栏） */
  function handleRenameFile(newName: string) {
    if (!selectedFile.value || selectedFile.value.id === undefined) return;
    editState.renamedFileIds.add(selectedFile.value.id);
    selectedFile.value.filename = newName;
    /** 强制触发 shareData.files 数组更新 */
    triggerFilesUpdate();
  }

  /** 处理侧边栏文件重命名 */
  function handleFileRename(file: ShareFileJSON, newName: string) {
    if (file.id !== undefined) editState.renamedFileIds.add(file.id);
    file.filename = newName;
    if (selectedFile.value?.id === file.id) {
      selectedFile.value = { ...file, filename: newName };
    }
    triggerFilesUpdate();
  }

  /** 判断文件是否有未保存修改 */
  function isFileModified(file: ShareFileJSON): boolean {
    const fid = file.id;
    if (fid === undefined) return false;
    return (isTextFile(file.mimetype) && isTextModified(fid)) || editState.renamedFileIds.has(fid);
  }

  /** 合并所有修改过的文件 id 集合 */
  const modifiedFileIds = computed(() => {
    const ids = new Set([...editState.renamedFileIds, ...getModifiedTextFileIds()]);
    return ids;
  });

  /** 强制触发文件列表响应式更新 */
  function triggerFilesUpdate() {
    if (!shareData.value) return;
    shareData.value = {
      ...shareData.value,
      data: { ...shareData.value.data, files: [...shareData.value.data.files] },
    };
  }

  function enterEditMode() {
    const currentPath = route.path;
    window.location.href = `${currentPath}?mode=edit`;
  }

  function toggleDeleteFile(fileId: number) {
    if (editState.deletedFileIds.has(fileId)) {
      editState.deletedFileIds.delete(fileId);
    } else {
      editState.deletedFileIds.add(fileId);
    }
  }

  function createTextFile() {
    const tempId = newTextIdCounter--;
    const filename = `untitled-${Math.abs(tempId)}.md`;
    editState.newTextFiles.set(tempId, { filename, content: '' });

    /** 临时 ShareFileJSON 加入列表 */
    const tempFile: ShareFileJSON = {
      id: tempId,
      path: '',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      authorId: authInfo.value?.userId ?? '',
      filename,
      mimetype: 'text/markdown',
      size: 0,
    };
    shareData.value?.data.files.push(tempFile);
    originalTexts[tempId] = '';
    currentTexts[tempId] = '';
    handleFileSelect(tempFile, shareData.value!.data.files.length - 1);
  }

  function handleUploadFiles(files: File[]) {
    editState.pendingUploads.push(...files);
  }

  /** 替换当前文件内容 */
  const replaceFileInputRef = ref<HTMLInputElement>();

  function triggerReplaceFile() {
    replaceFileInputRef.value?.click();
  }

  /** 待替换的文件 id（覆盖式上传目标） */
  const replaceTargetId = ref<number>();

  async function onReplaceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || selectedFile.value?.id === undefined) return;

    const fileId = selectedFile.value.id;
    const targetIsText = isTextFile(selectedFile.value.mimetype);

    if (targetIsText) {
      /** 目标是文本文件：读取新文件内容为文本，更新编辑器 */
      const text = await file.text();
      currentTexts[fileId] = text;
      /** 更新 size */
      selectedFile.value = { ...selectedFile.value, size: file.size };
      triggerFilesUpdate();
    } else {
      /** 目标是二进制文件：暂存 File 对象，保存时走覆盖式上传 */
      selectedFile.value = {
        ...selectedFile.value,
        mimetype: file.type || selectedFile.value.mimetype,
        size: file.size,
      };
      replaceTargetId.value = fileId;
      editState.pendingUploads.push(file);
      triggerFilesUpdate();
    }

    input.value = '';
    toast.info(t('文件已暂存'), t('点击保存按钮生效'));
  }

  // ──────────────── 保存 ────────────────

  async function save() {
    if (!shareData.value || !isEditMode.value) return;
    isSaving.value = true;

    const files = shareData.value.data.files;
    const uploadPromises: Promise<ShareFileJSON>[] = [];

    // 1. 上传新建的文本文件
    for (const [tempId, { filename: fname, content: fcontent }] of editState.newTextFiles) {
      const mimetype = guessMimetype(fname);
      const blob = new Blob([fcontent], { type: mimetype });
      uploadPromises.push(uploadPublic(blob, fname));

      // 从 files 中移除临时条目
      const idx = files.findIndex((f) => f.id === tempId);
      if (idx !== -1) files.splice(idx, 1);
    }

    // 2. 覆盖式上传修改过的文本文件
    for (const fileId of getModifiedTextFileIds()) {
      const existingFile = files.find((f) => f.id === fileId);
      if (!existingFile) continue;

      const content = currentTexts[fileId] ?? '';
      const blob = new Blob([content], { type: existingFile.mimetype });
      uploadPromises.push(overwriteUpload(fileId, blob, existingFile.filename));

      // 从列表中移除旧条目
      const idx = files.findIndex((f) => f.id === fileId);
      if (idx !== -1) files.splice(idx, 1);
    }

    // 3. 处理待上传的文件（区分替换和新增）
    for (const file of editState.pendingUploads) {
      const targetId = replaceTargetId.value;
      const existingFile = targetId ? files.find((f) => f.id === targetId) : undefined;

      if (existingFile && targetId !== undefined) {
        // 覆盖式上传：保留原文件名，替换内容
        uploadPromises.push(overwriteUpload(targetId, file, existingFile.filename));
        const idx = files.findIndex((f) => f.id === targetId);
        if (idx !== -1) files.splice(idx, 1);
        replaceTargetId.value = undefined;
      } else {
        // 新增文件
        uploadPromises.push(uploadPublic(file));
      }
    }

    // 4. 删除标记的文件
    const deletePromises = Array.from(editState.deletedFileIds).map((fileId) =>
      API.fileApi.delete(fileId),
    );

    const [uploadedResults] = await Promise.all([
      Promise.all(uploadPromises),
      Promise.all(deletePromises),
    ]);

    // 5. 合并文件列表
    files.push(...uploadedResults);

    // 6. 移除已删除的文件
    const finalFiles = files.filter((f) => !editState.deletedFileIds.has(f.id));

    // 7. 更新 UserData
    await API.db.userData.update({
      where: { id: shareData.value.id },
      data: {
        description: title.value,
        data: toJsonValue(JSON.stringify({
          title: title.value,
          files: finalFiles,
        })),
      },
    });

    // 8. 重置编辑状态
    resetEditState();

    // 9. 刷新数据
    shareData.value = {
      ...shareData.value,
      data: { title: title.value, files: finalFiles },
    };

    toast.success(t('保存成功'));
    isSaving.value = false;
  }

  // ──────────────── 查看模式操作 ────────────────

  async function downloadFile(file: ShareFileJSON) {
    let url = '';
    if (authInfo_isLogin.value) {
      url = await APIGetUrl.fileApi.file(file.id);
    } else {
      url = await AppAPIGetUrl.fileApi.file(file.id);
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function openInNewTab(file: ShareFileJSON) {
    let url = '';
    if (authInfo_isLogin.value) {
      url = await APIGetUrl.fileApi.file(file.id);
    } else {
      url = await AppAPIGetUrl.fileApi.file(file.id);
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
</script>
