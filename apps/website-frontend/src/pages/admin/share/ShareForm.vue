<style scoped></style>
<template>
  <div class="p-4">
    <div class="mb-4">
      <label class="block text-sm font-medium mb-1">{{ $t('标题') }}</label>
      <InputText v-model="formData.title" class="w-full" :placeholder="$t('请输入标题')" />
    </div>

    <div class="mb-4">
      <label class="block text-sm font-medium mb-1">{{ $t('文件上传') }}</label>
      <FileUpload
        mode="basic"
        :chooseLabel="$t('选择文件')"
        :uploadLabel="$t('上传')"
        :cancelLabel="$t('取消')"
        @select="onFileSelect"
        :multiple="true"
        accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        class="w-full" />
    </div>

    <!-- 已选择的文件列表 -->
    <div v-if="selectedFiles.length > 0" class="mb-4">
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
    <div v-if="uploadedFiles.length > 0" class="mb-4">
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

    <div class="flex justify-end">
      <Button
        :label="$t('提交')"
        @click="submit"
        :disabled="isSubmitting"
        :loading="isSubmitting" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON, ShareJSON } from '@/pages/admin/share/ShareDef';
  import { authInfo } from '@/storage';
  import { userDataAppid } from '@/storage/userDataAppid';
  import { ref } from 'vue';

  const { API } = useAPI();

  /** 表单数据 */
  const formData = ref({
    /** 标题 */
    title: '',
  });

  /** 表单类型 */
  const formType = ref<'create' | 'update'>('create');

  /** 选中的文件列表（尚未上传） */
  const selectedFiles = ref<File[]>([]);

  /** 已上传的文件列表 */
  const uploadedFiles = ref<ShareFileJSON[]>([]);

  /** 是否正在提交 */
  const isSubmitting = ref(false);

  /**
   * 文件选择处理
   * @param event 文件选择事件
   */
  function onFileSelect(event: any) {
    const files = event.files as File[];
    selectedFiles.value.push(...files);
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
    try {
      await API.fileApi.delete(file.id);
      uploadedFiles.value.splice(index, 1);
    } catch (error) {
      console.error('Failed to delete file:', error);
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
        const result = await API.fileApi.upload(file);
        uploadedFiles.value.push(result);
      }

      // 清空选中的文件
      selectedFiles.value = [];

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

      // 重置表单
      formData.value.title = '';
      uploadedFiles.value = [];
    } finally {
      isSubmitting.value = false;
    }
  }
</script>
