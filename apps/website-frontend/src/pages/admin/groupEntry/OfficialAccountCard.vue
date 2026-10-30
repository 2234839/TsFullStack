<template>
  <Card class="p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-primary-title">{{ t('公众号长期引导') }}</h2>
        <p class="mt-1 text-sm leading-6 text-primary-theme">
          {{ t('有效入群页也会展示公众号，方便用户长期关注；无法入群时，公众号作为主要引导。') }}
        </p>
      </div>
      <Tag variant="success">{{ t('不受群码 7 天有效期限制') }}</Tag>
    </div>

    <form class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]" @submit.prevent="save">
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm font-medium text-primary-label">
            {{ t('公众号名称') }} <span class="text-danger-500">*</span>
            <Input v-model="name" class="mt-1 w-full" :disabled="saving" required maxlength="100" />
          </label>
          <label class="block text-sm font-medium text-primary-label">
            {{ t('回复关键词') }}
            <Input v-model="replyKeyword" class="mt-1 w-full" :disabled="saving" maxlength="50" />
          </label>
        </div>
        <label class="block text-sm font-medium text-primary-label">
          {{ t('关注引导语') }}
          <Textarea
            v-model="guideText"
            class="mt-1 w-full"
            :rows="3"
            :disabled="saving"
            :placeholder="t('例如：关注后回复关键词，获取最新入群方式和群码更新通知。')"
          />
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <FileUpload
            accept="image/png,image/jpeg,image/webp"
            :choose-label="selectedFile ? t('重新选择二维码') : t('选择公众号二维码')"
            :disabled="saving"
            @select="selectFile"
          />
          <Button
            type="submit"
            icon="pi pi-save"
            :label="t('保存公众号配置')"
            :loading="saving"
            :disabled="!name.trim()"
          />
        </div>
        <p class="text-xs leading-5 text-primary-theme">
          {{
            t('保存会同时更新文字配置；若已选择图片，也会上传并替换公众号二维码。支持 PNG / JPEG / WebP，最大 5MB。')
          }}
        </p>
      </div>

      <div class="rounded-lg border border-primary-default bg-primary-card p-4 text-center">
        <p class="mb-3 text-sm font-medium text-primary-title">{{ t('当前公开页展示') }}</p>
        <img
          v-if="currentQrUrl && !imageFailed"
          :src="currentQrUrl"
          :alt="t('公众号二维码预览')"
          class="mx-auto h-40 w-40 rounded-lg bg-white object-contain p-2"
          @error="imageFailed = true"
        />
        <div
          v-else
          class="grid h-40 place-items-center rounded-lg border border-dashed border-primary-default text-sm text-primary-theme"
        >
          {{ t('暂无可用二维码') }}
        </div>
        <p v-if="imageFailed" class="mt-3 text-xs text-danger-500">{{ t('图片加载失败，请重新上传') }}</p>
        <p class="mt-3 break-words text-xs leading-5 text-primary-theme">
          {{ name || t('未命名公众号') }} · {{ t('回复') }}「{{ replyKeyword || t('加群') }}」
        </p>
      </div>
    </form>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useObjectUrl } from '@vueuse/core';
import { Button, Card, FileUpload, Input, Tag, Textarea } from '@/components/base';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/utils/error';
import { ALLOWED_QR_FILE_TYPES, MAX_QR_FILE_SIZE, officialAccountQrUrl, type GroupEntrySettings } from './types';

const props = defineProps<{ settings?: GroupEntrySettings }>();
const emit = defineEmits<{ saved: [] }>();
const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const name = ref('');
const replyKeyword = ref('加群');
const guideText = ref('');
const selectedFile = shallowRef<File>();
const previewUrl = useObjectUrl(selectedFile);
const saving = ref(false);
const imageFailed = ref(false);
const currentQrUrl = computed(() => {
  if (previewUrl.value) return previewUrl.value;
  const qrUrl = props.settings?.fallback.qrUrl;
  return qrUrl ? officialAccountQrUrl(qrUrl) : undefined;
});

watch(
  () => props.settings,
  (settings) => {
    if (!settings) return;
    name.value = settings.fallback.accountName;
    replyKeyword.value = settings.fallback.replyKeyword;
    guideText.value = settings.fallback.guideText ?? '';
    imageFailed.value = false;
  },
  { immediate: true },
);

function selectFile(event: { files: File[] }) {
  const file = event.files[0];
  if (!file) return;
  if (!ALLOWED_QR_FILE_TYPES.has(file.type)) {
    toast.error(t('仅支持 PNG、JPEG 或 WebP 图片'));
    return;
  }
  if (file.size === 0 || file.size > MAX_QR_FILE_SIZE) {
    toast.error(t('图片大小须在 1B 到 5MB 之间'));
    return;
  }
  selectedFile.value = file;
  imageFailed.value = false;
}

async function save() {
  if (!name.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await API.groupEntryApi.updateOfficialAccount(name.value, replyKeyword.value, guideText.value);
    if (selectedFile.value) await API.groupEntryApi.uploadOfficialQr(selectedFile.value);
    selectedFile.value = undefined;
    toast.success(t('公众号配置已保存'));
    emit('saved');
  } catch (error: unknown) {
    toast.error(t('保存公众号配置失败'), getErrorMessage(error));
  } finally {
    saving.value = false;
  }
}
</script>
