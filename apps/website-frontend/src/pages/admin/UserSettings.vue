<template>
  <div class="user-settings-page p-6 max-w-4xl mx-auto">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-primary-900 dark:text-primary-50 flex items-center gap-2">
        <i class="pi pi-user text-primary-600" />
        {{ t('个人设置') }}
      </h1>
    </div>

    <!-- 设置卡片 -->
    <Card class="p-6">
      <div v-if="userProfileLoading" class="flex justify-center py-8">
        <ProgressSpinner />
      </div>

      <div v-else class="space-y-6">
        <!-- 头像设置 -->
        <div class="setting-section">
          <h3 class="text-lg font-medium text-secondary-800 dark:text-white mb-4">{{ t('头像设置') }}</h3>
          <div class="flex items-center gap-6">
            <!-- 头像预览 -->
            <div class="w-16 h-16 rounded-full overflow-hidden shadow-lg border-4 border-secondary-200 dark:border-secondary-700 shrink-0 bg-secondary-100 dark:bg-secondary-800">
              <File2Url v-if="avatarUrl" :fileId="avatarUrl" v-slot="{ url, loading }">
                <div v-if="loading" class="w-full h-full flex items-center justify-center">
                  <i class="pi pi-spinner pi-spin text-secondary-400"></i>
                </div>
                <img v-else :src="url" alt="用户头像" class="w-full h-full object-cover" />
              </File2Url>
              <img v-else :src="defaultAvatar" alt="默认头像" class="w-full h-full object-cover" />
            </div>
            <div class="space-y-3">
              <div>
                <Button
                  :label="uploading ? t('上传中...') : t('上传头像')"
                  :icon="uploading ? 'pi pi-spinner pi-spin' : 'pi pi-upload'"
                  :disabled="uploading"
                  @click="triggerFileInput"
                />
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileUpload"
                />
              </div>
              <p class="text-sm text-secondary-500 dark:text-secondary-400">
                {{ t('支持 JPG、PNG 格式，文件大小不超过 2MB') }}
              </p>
              <Button
                v-if="avatarUrl"
                variant="danger"
                size="small"
                :label="removing ? t('删除中...') : t('删除头像')"
                :icon="removing ? 'pi pi-spinner pi-spin' : 'pi pi-trash'"
                :disabled="removing"
                @click="handleRemoveAvatar"
              />
            </div>
          </div>
        </div>

        <!-- 昵称设置 -->
        <div class="setting-section">
          <h3 class="text-lg font-medium text-secondary-800 dark:text-white mb-4">{{ t('昵称设置') }}</h3>
          <div class="max-w-md space-y-3">
            <div class="flex gap-2">
              <Input
                v-model="nicknameInput"
                :placeholder="t('请输入昵称')"
                :maxlength="20"
                class="flex-1"
              />
              <Button
                :label="savingNickname ? t('保存中...') : t('保存')"
                :icon="savingNickname ? 'pi pi-spinner pi-spin' : 'pi pi-check'"
                :disabled="!nicknameChanged || savingNickname"
                @click="handleSaveNickname"
              />
            </div>
            <p class="text-sm text-secondary-500 dark:text-secondary-400">
              {{ t('昵称将显示在侧边栏和其他地方') }}
            </p>
          </div>
        </div>

        <!-- 账户信息 -->
        <div class="setting-section">
          <h3 class="text-lg font-medium text-secondary-800 dark:text-white mb-4">{{ t('账户信息') }}</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between py-2 border-b border-secondary-200 dark:border-secondary-700">
              <span class="text-secondary-600 dark:text-secondary-400">{{ t('邮箱') }}</span>
              <span class="font-medium text-secondary-800 dark:text-white">{{ userProfile?.email }}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-secondary-200 dark:border-secondary-700">
              <span class="text-secondary-600 dark:text-secondary-400">{{ t('用户 ID') }}</span>
              <span class="font-mono text-secondary-800 dark:text-white">{{ userProfile?.id }}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
  import { useUserProfile } from '@/composables/useUserProfile';
  import { API } from '@/api';
  import Card from '@/components/base/Card.vue';
  import Button from '@/components/base/Button.vue';
  import Input from '@/components/base/Input.vue';
  import ProgressSpinner from '@/components/base/ProgressSpinner.vue';
  import File2Url from '@/pages/admin/components/File2Url.vue';
  import { ref, computed, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { useToast } from '@/composables/useToast';
  import { useConfirm } from '@/composables/useConfirm';
  import defaultAvatar from '/崮生.png?url';

  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    userProfile,
    avatarUrl,
    updateNickname,
    updateAvatar,
    refresh,
    loading: userProfileLoading,
  } = useUserProfile();

  /** 文件输入引用 */
  const fileInputRef = ref<HTMLInputElement | null>(null);
  /** 上传状态 */
  const uploading = ref(false);
  /** 删除头像状态 */
  const removing = ref(false);
  /** 保存昵称状态 */
  const savingNickname = ref(false);
  /** 昵称输入 */
  const nicknameInput = ref(userProfile.value?.nickname || '');

  /** 监听 userProfile 变化，同步更新昵称输入框 */
  watch(
    () => userProfile.value?.nickname || '',
    (newNickname) => {
      if (newNickname !== nicknameInput.value) {
        nicknameInput.value = newNickname;
      }
    },
  );

  /** 昵称是否有变化 */
  const nicknameChanged = computed(() => {
    return nicknameInput.value !== (userProfile.value?.nickname || '');
  });

  /** 触发文件选择 */
  function triggerFileInput() {
    fileInputRef.value?.click();
  }

  /** 处理文件上传 */
  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error(t('错误'), t('请选择图片文件'));
      return;
    }

    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('错误'), t('图片大小不能超过 2MB'));
      return;
    }

    uploading.value = true;

    try {
      // 使用后端的文件上传 API
      const uploadedFile = await API.fileApi.upload(file);

      // 更新用户头像，存储文件 ID
      await updateAvatar(String(uploadedFile.id));

      // 刷新用户信息
      await refresh();

      toast.success(t('成功'), t('头像上传成功'));
    } catch (error: unknown) {
      toast.error(t('错误'), t('头像上传失败，请重试'));
    } finally {
      uploading.value = false;
      // 清空文件输入
      if (target) {
        target.value = '';
      }
    }
  }

  /** 删除头像 */
  async function handleRemoveAvatar() {
    const confirmed = await confirm.require({
      message: t('确定要删除头像吗？'),
      header: t('删除头像'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('确认'),
      rejectLabel: t('取消'),
    });

    if (!confirmed) return;

    removing.value = true;

    try {
      await updateAvatar('');
      await refresh();
      toast.success(t('成功'), t('头像已删除'));
    } catch (error: unknown) {
      toast.error(t('错误'), t('删除头像失败，请重试'));
    } finally {
      removing.value = false;
    }
  }

  /** 保存昵称 */
  async function handleSaveNickname() {
    if (!nicknameInput.value.trim()) {
      toast.warn(t('提示'), t('昵称不能为空'));
      return;
    }

    savingNickname.value = true;

    try {
      await updateNickname(nicknameInput.value.trim());
      await refresh();
      toast.success(t('成功'), t('昵称保存成功'));
    } catch (error: unknown) {
      toast.error(t('错误'), t('保存昵称失败，请重试'));
    } finally {
      savingNickname.value = false;
    }
  }
</script>

<style scoped>
  .setting-section {
    border-bottom: 1px solid oklch(var(--color-secondary-200));
    padding-bottom: 1.5rem;
  }
  .setting-section:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .dark .setting-section {
    border-bottom-color: oklch(var(--color-secondary-700));
  }
</style>
