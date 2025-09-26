<style scoped></style>
<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="dialogTitle"
    :modal="true"
    :style="{ width: '50rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
    <div class="flex flex-col gap-4">
      <div class="field">
        <label class="block text-sm font-medium mb-1">{{ $t('标题') }}</label>
        <InputText v-model="formData.title" class="w-full" :placeholder="$t('请输入标题')" />
      </div>

      <div class="field">
        <label class="block text-sm font-medium mb-1">{{ $t('文件上传') }}</label>
        <input
          type="file"
          multiple
          @change="onFileSelect"
          class="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600"
          :placeholder="$t('请选择文件')" />
      </div>

      <!-- 已选择的文件列表 -->
      <div v-if="selectedFiles.length > 0" class="field">
        <h4 class="text-sm font-medium mb-2">{{ $t('已选择的文件') }}</h4>
        <div
          v-for="(file, index) in selectedFiles"
          :key="index"
          class="flex items-center justify-between p-2 border rounded mb-1 dark:border-gray-600">
          <span>{{ file.name }}</span>
          <Button
            icon="pi pi-times"
            text
            rounded
            @click="removeSelectedFile(index)"
            :aria-label="$t('移除文件')" />
        </div>
      </div>

      <!-- 已上传的文件列表 -->
      <div v-if="uploadedFiles.length > 0" class="field">
        <h4 class="text-sm font-medium mb-2">{{ $t('已上传的文件') }}</h4>
        <div
          v-for="(file, index) in uploadedFiles"
          :key="file.id"
          class="flex items-center justify-between p-2 border rounded mb-1 dark:border-gray-600">
          <span>{{ file.filename }}</span>
          <Button
            icon="pi pi-times"
            text
            rounded
            @click="removeUploadedFile(index)"
            :aria-label="$t('移除文件')" />
        </div>
      </div>
    </div>

    <template #footer>
      <Button :label="$t('取消')" icon="pi pi-times" text @click="close" />
      <Button
        :label="$t('提交')"
        icon="pi pi-check"
        @click="submit"
        :disabled="isSubmitting"
        :loading="isSubmitting" />
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

  const { API } = useAPI();

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

  /** 是否正在提交 */
  const isSubmitting = ref(false);

  /** 对话框标题 */
  const dialogTitle = computed(() => {
    return formType.value === 'create' ? '新建分享' : '编辑分享';
  });

  /**
   * 监听编辑项变化
   */
  watch(
    () => props.editingItem,
    (newItem) => {
      if (newItem) {
        formType.value = 'update';
        editingId.value = newItem.id;
        formData.value.title = (newItem.data as ShareJSON).title;
        uploadedFiles.value = [...(newItem.data as ShareJSON).files];
        selectedFiles.value = [];
      } else {
        resetForm();
      }
    },
    { immediate: true },
  );

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
   * 移除已上传的文件
   * @param index 文件索引
   */
  async function removeUploadedFile(index: number) {
    const file = uploadedFiles.value[index];
    if (file) {
      await API.fileApi.delete(file.id);
      uploadedFiles.value.splice(index, 1);
    }
  }

  /**
   * 提交表单
   */
  async function submit() {
    isSubmitting.value = true;
    try {
      // 先上传所有选中的文件
      for (const file of selectedFiles.value) {
        const { id } = await API.fileApi.upload(file);
        const result = await API.fileApi.updateFileStatus(id, $Enums.FileStatusEnum.public);
        uploadedFiles.value.push(result);
      }

      // 清空选中的文件
      selectedFiles.value = [];

      if (formType.value === 'create') {
        // 创建用户数据
        await API.db.userData.create({
          data: {
            appId: userDataAppid.shareInfo,
            userId: authInfo.value.userId,
            key: crypto.randomUUID(),
            data: {
              title: formData.value.title,
              files: uploadedFiles.value,
            } satisfies ShareJSON,
          },
        });
      } else if (formType.value === 'update' && editingId.value) {
        // 更新用户数据
        await API.db.userData.update({
          where: { id: editingId.value },
          data: {
            data: {
              title: formData.value.title,
              files: uploadedFiles.value,
            } satisfies ShareJSON,
          },
        });
      }

      // 关闭对话框并通知成功
      close();
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
    resetForm();
  }

  /**
   * 重置表单
   */
  function resetForm() {
    formData.value.title = '';
    selectedFiles.value = [];
    uploadedFiles.value = [];
    formType.value = 'create';
    editingId.value = undefined;
  }
</script>
