<style scoped>
/* 仅保留一些动画效果，其他样式使用 Tailwind CSS */
</style>
<template>
  <Dialog v-model:open="localVisible" :title="dialogTitle">
    <div class="flex flex-col gap-4">
      <Input v-model="formData.title" :placeholder="t('请输入标题')" />

      <!-- 加密设置 -->
      <div class="p-4 rounded-lg border border-primary-default bg-primary-50 dark:bg-primary-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-lock text-primary-500" />
            <span class="text-sm font-semibold text-primary-label">{{ t("加密分享") }}</span>
          </div>
          <ToggleSwitch v-model="formData.encrypted" />
        </div>
        <template v-if="formData.encrypted">
          <p class="text-xs text-primary-subtle mb-3">
            {{ t("文件内容将在上传前加密，密码不存储在服务器。通过链接中的密码可直接访问。") }}
          </p>
          <div class="flex gap-2">
            <Password
              v-model="formData.password"
              :placeholder="t('密码')"
              :feedback="false"
              toggleMask
              class="flex-1"
              :inputClass="'w-full'"
            />
            <Button
              variant="secondary"
              size="sm"
              class="shrink-0"
              @click="formData.password = generateRandomPassword()"
              :title="t('随机生成')"
            >
              <i class="pi pi-refresh" />
            </Button>
          </div>
        </template>
      </div>

      <!-- 文件上传区域 -->
      <div
        class="upload-area border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 bg-primary-50 dark:bg-primary-800 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        @click="triggerFileInput"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <input
          ref="fileInputRef"
          type="file"
          multiple
          @change="onFileSelect"
          class="hidden"
          :placeholder="t('请选择文件')"
        />
        <div class="text-primary-subtle mb-4 flex justify-center">
          <i class="pi pi-cloud-upload text-5xl"></i>
        </div>
        <div class="text-sm text-primary-theme mb-1">{{ t("点击或拖拽文件到此处上传") }}</div>
        <div class="text-xs text-primary-500 dark:text-primary-500">
          {{ t("支持多个文件同时上传") }}
        </div>
      </div>

      <!-- 已选择的文件列表 -->
      <div v-if="selectedFiles.length > 0">
        <div class="text-sm font-semibold text-primary-label mb-3">{{ t("已选择的文件") }}</div>
        <div
          v-for="(file, index) in selectedFiles"
          :key="`${file.name}-${file.size}-${index}`"
          class="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-800 border border-primary-default rounded-lg mb-2 last:mb-0 hover:bg-primary-100 dark:hover:bg-primary-750 hover:border-primary-300 dark:hover:border-primary-600 transition-all"
        >
          <div class="flex items-center gap-3 text-sm text-primary-label min-w-0 flex-1">
            <i class="pi pi-file text-xl shrink-0 text-primary-subtle"></i>
            <span class="truncate flex-1">{{ file.name }}</span>
            <span class="text-xs text-primary-subtle shrink-0 ml-2">{{
              formatFileSize(file.size)
            }}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="text-primary-subtle hover:bg-danger-100 dark:hover:bg-danger-900/20 hover:text-danger-600! dark:hover:text-danger-400!"
            @click="removeSelectedFile(index)"
            :aria-label="t('移除文件')"
          >
            <i class="pi pi-times"></i>
          </Button>
        </div>
      </div>

      <!-- 已上传的文件列表 -->
      <div v-if="uploadedFiles.length > 0">
        <div class="text-sm font-semibold text-primary-label mb-3">{{ t("已上传的文件") }}</div>
        <div
          v-for="file in uploadedFiles"
          :key="file.id"
          class="flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 transition-all"
          :class="
            isFileMarkedForDeletion(file.id)
              ? 'bg-primary-100 dark:bg-primary-900 border border-primary-300 dark:border-primary-600 opacity-60'
              : 'bg-primary-50 dark:bg-primary-800 border border-primary-default hover:bg-primary-100 dark:hover:bg-primary-700 hover:border-primary-300 dark:hover:border-primary-600'
          "
        >
          <div
            class="flex items-center gap-3 text-sm min-w-0 flex-1"
            :class="
              isFileMarkedForDeletion(file.id)
                ? 'text-primary-500 dark:text-primary-500 line-through'
                : 'text-primary-label'
            "
          >
            <i
              class="pi pi-file text-xl shrink-0"
              :class="
                isFileMarkedForDeletion(file.id)
                  ? 'text-primary-400 dark:text-primary-600'
                  : 'text-primary-subtle'
              "
            ></i>
            <span class="truncate flex-1">{{ file.filename }}</span>
            <span
              class="text-xs shrink-0 ml-2"
              :class="
                isFileMarkedForDeletion(file.id)
                  ? 'text-primary-400 dark:text-primary-600'
                  : 'text-primary-subtle'
              "
              >{{ formatFileSize(file.size ?? 0) }}</span
            >
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :class="isFileMarkedForDeletion(file.id) ? 'text-primary-theme' : 'text-primary-subtle'"
            @click="toggleFileDeletion(file.id)"
            :aria-label="isFileMarkedForDeletion(file.id) ? t('撤销删除') : t('移除文件')"
          >
            {{ isFileMarkedForDeletion(file.id) ? t("撤销") : "" }}
            <i :class="isFileMarkedForDeletion(file.id) ? 'pi pi-refresh' : 'pi pi-times'"></i>
          </Button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="close">
          {{ t("取消") }}
        </Button>
        <Button :disabled="isSubmitting" :loading="isSubmitting" @click="submit">
          {{ isSubmitting ? t("提交中...") : t("提交") }}
        </Button>
      </div>
    </template>
  </Dialog>

  <!-- 加密分享链接展示对话框 -->
  <Dialog v-model:open="showShareUrlDialog" :title="t('加密分享创建成功')">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2 text-success-600 dark:text-success-400">
        <i class="pi pi-check-circle text-xl" />
        <span class="text-sm">{{ t("分享已加密创建成功，请保存以下链接分享给他人") }}</span>
      </div>
      <div class="bg-primary-50 dark:bg-primary-800 border border-primary-default rounded-lg p-3">
        <p class="text-xs text-primary-subtle mb-2">{{ t("分享链接（包含密码，请妥善保管）") }}</p>
        <div
          class="text-xs text-primary-label break-all font-mono bg-primary-card dark:bg-primary-900 p-2 rounded border border-primary-default max-h-32 overflow-y-auto"
        >
          {{ encryptedShareUrl }}
        </div>
      </div>
      <p class="text-xs text-warning-600 dark:text-warning-400">
        <i class="pi pi-info-circle mr-1" />
        {{ t("此链接包含解密密码，丢失后将无法恢复文件内容") }}
      </p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="showShareUrlDialog = false">
          {{ t("关闭") }}
        </Button>
        <Button @click="copyShareUrl">
          <i class="pi pi-copy mr-1" />
          {{ t("复制链接") }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useAPI } from "@/api";
import type { ShareFileJSON, ShareItemJSON, ShareJSON } from "@/pages/admin/share/ShareDef";
import { authInfo } from "@/storage";
import { userDataAppid } from "@/storage/userDataAppid";
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import { getErrorMessage } from "@/utils/error";
import { Dialog } from "@tsfullstack/shared-frontend/components";
import { formatFileSize } from "@/utils/format";
import { toJsonValue } from "@/utils/apiType";
import { ShareCrypto, generateRandomPassword, base64UrlEncode } from "@/utils/shareCrypto";
import { useFileUpload } from "@/composables/useFileUpload";
import { isEncryptedData, getPlaintextShare, type ShareData } from "@/pages/admin/share/ShareDef";
import { copyToClipboard } from "@/utils/clipboard";

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
  (e: "update:open", value: boolean): void;
  (e: "success"): void;
}>();

/** 本地的 open 状态，支持双向绑定 */
const localVisible = computed<boolean>({
  get: () => open,
  set: (value: boolean) => emit("update:open", value),
});

/** 表单数据 */
const formData = ref({
  /** 标题 */
  title: "",
  /** 是否加密分享 */
  encrypted: true,
  /** 加密密码（仅创建时使用，不提交到后端） */
  password: generateRandomPassword(),
});

/** 表单类型 */
const formType = ref<"create" | "update">("create");

/** 当前编辑的分享ID */
const editingId = ref<number>();

/** 选中的文件列表（尚未上传） */
const selectedFiles = ref<File[]>([]);

/** 已上传的文件列表 */
const uploadedFiles = shallowRef<ShareFileJSON[]>([]);

/** 标记为删除的文件ID集合 */
const deletedFileIds = ref<Set<number>>(new Set());

/** 是否正在提交 */
const isSubmitting = shallowRef(false);

/** 加密分享的完整链接（含密码 hash），创建成功后展示 */
const encryptedShareUrl = ref("");
/** 是否显示分享链接对话框 */
const showShareUrlDialog = ref(false);

/** 切换文件删除状态 */
function toggleFileDeletion(fileId: number) {
  if (isFileMarkedForDeletion(fileId)) {
    undoRemoveFile(fileId);
  } else {
    removeUploadedFile(fileId);
  }
}

/** 文件输入框引用 */
const fileInputRef = ref<HTMLInputElement>();

/** 对话框标题 */
const dialogTitle = computed(() => {
  return formType.value === "create" ? t("新建分享") : t("编辑分享");
});

/**
 * 加载编辑项数据
 * 注意：加密分享的文件列表在密文中，编辑时需要密码才能解密
 * 如果没有密码，只能显示标题（从 description 字段），文件列表为空
 */
function loadEditingItem() {
  if (editingItem) {
    formType.value = "update";
    editingId.value = editingItem.id;

    if (isEncryptedData(editingItem.data)) {
      /** 加密分享：标题从 description 字段取，文件列表无法显示（需要密码） */
      formData.value.title = editingItem.description ?? "";
      formData.value.encrypted = true;
      uploadedFiles.value = [];
      selectedFiles.value = [];
      /** 编辑加密分享时需要用户输入新密码重新加密 */
      formData.value.password = "";
    } else {
      /** 非加密分享：正常加载 */
      const plainShare = getPlaintextShare(editingItem);
      formData.value.title = plainShare?.title ?? editingItem.description ?? "";
      formData.value.encrypted = false;
      uploadedFiles.value = [...(plainShare?.files ?? [])];
      selectedFiles.value = [];
    }
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
    event.dataTransfer.dropEffect = "copy";
  }
  const target = event.target as HTMLElement;
  target.closest(".upload-area")?.classList.add("drag-over");
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(event: DragEvent) {
  const target = event.target as HTMLElement;
  target.closest(".upload-area")?.classList.remove("drag-over");
}

/**
 * 处理文件拖放
 */
function handleDrop(event: DragEvent) {
  const target = event.target as HTMLElement;
  target.closest(".upload-area")?.classList.remove("drag-over");

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
    /** 加密分享时创建加密实例 */
    let cryptoInstance: ShareCrypto | undefined;
    if (formData.value.encrypted) {
      if (!formData.value.password) {
        toast.error(t("请输入加密密码"));
        isSubmitting.value = false;
        return;
      }
      cryptoInstance = await ShareCrypto.fromPassword(formData.value.password);
    }

    // 并发执行上传和删除操作（加密时先加密文件二进制内容）
    const uploadPromises = selectedFiles.value.map(async (file) => {
      const { uploadPublic } = useFileUpload();
      const result = await uploadPublic(file, undefined, cryptoInstance);
      return result;
    });

    const deletePromises = Array.from(deletedFileIds.value).map((fileId) =>
      API.fileApi.delete(fileId),
    );

    const [uploadedResults] = await Promise.all([
      Promise.all(uploadPromises),
      Promise.all(deletePromises),
    ]);

    uploadedFiles.value = [...uploadedFiles.value, ...uploadedResults];

    // 清空选中的文件
    selectedFiles.value = [];

    // 从列表中移除已删除的文件
    uploadedFiles.value = uploadedFiles.value.filter((file) => !deletedFileIds.value.has(file.id));

    // 清空删除标记
    deletedFileIds.value.clear();

    /** 构建明文 ShareJSON */
    const shareJson: ShareJSON = {
      title: formData.value.title,
      files: uploadedFiles.value,
    };

    if (formData.value.encrypted && cryptoInstance) {
      /** 加密分享：data 存密文 + salt，description 存明文标题供列表展示 */
      const payload = await cryptoInstance.encryptString(JSON.stringify(shareJson));
      const encryptedData = { encrypted: true as const, payload, salt: cryptoInstance.saltB64 };

      if (formType.value === "create") {
        const created = await API.db.userData.create({
          data: {
            appId: userDataAppid.shareInfo,
            userId: authInfo.value.userId,
            key: crypto.randomUUID(),
            description: formData.value.title,
            data: toJsonValue(JSON.stringify(encryptedData)),
          },
        });
        editingId.value = created.id;
        formType.value = "update";
      } else if (editingId.value !== undefined) {
        await API.db.userData.update({
          where: { id: editingId.value },
          data: {
            description: formData.value.title,
            data: toJsonValue(JSON.stringify(encryptedData)),
          },
        });
      }
    } else {
      /** 非加密分享：明文存储，兼容旧逻辑 */
      if (formType.value === "create") {
        const created = await API.db.userData.create({
          data: {
            appId: userDataAppid.shareInfo,
            userId: authInfo.value.userId,
            key: crypto.randomUUID(),
            description: formData.value.title,
            data: toJsonValue(JSON.stringify(shareJson)),
          },
        });
        editingId.value = created.id;
        formType.value = "update";
      } else if (editingId.value !== undefined) {
        await API.db.userData.update({
          where: { id: editingId.value },
          data: {
            description: formData.value.title,
            data: toJsonValue(JSON.stringify(shareJson)),
          },
        });
      }
    }

    // 通知成功，但不关闭对话框
    emit("success");

    /** 加密分享创建成功后，生成含密码的分享链接并显示 */
    if (formData.value.encrypted && cryptoInstance && editingId.value !== undefined) {
      const baseUrl = window.location.origin;
      const passwordB64 = base64UrlEncode(new TextEncoder().encode(formData.value.password));
      encryptedShareUrl.value = `${baseUrl}/ShareDetail/${editingId.value}#k=${cryptoInstance.saltB64}&p=${passwordB64}`;
      showShareUrlDialog.value = true;
    }
  } catch (error: unknown) {
    toast.error(t("保存失败"), getErrorMessage(error, t("保存分享信息时发生错误")));
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * 关闭对话框
 */
function close() {
  emit("update:open", false);
}

/** 复制加密分享链接 */
async function copyShareUrl() {
  try {
    await copyToClipboard(encryptedShareUrl.value);
    toast.success(t("链接已复制到剪贴板"));
  } catch {
    toast.error(t("复制失败"));
  }
}

/**
 * 重置表单
 */
function resetForm() {
  formData.value.title = "";
  formData.value.encrypted = true;
  formData.value.password = generateRandomPassword();
  selectedFiles.value = [];
  uploadedFiles.value = [];
  deletedFileIds.value.clear();
  formType.value = "create";
  editingId.value = undefined;
}
</script>
