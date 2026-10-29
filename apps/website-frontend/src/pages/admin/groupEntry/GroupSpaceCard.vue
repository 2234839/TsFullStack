<template>
  <Card class="overflow-hidden">
    <div class="border-b border-primary-default p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-xl font-semibold text-primary-title">{{ space.displayName || space.name }}</h2>
            <code class="rounded bg-primary-card px-2 py-1 text-xs text-primary-theme">/group/{{ space.name }}</code>
          </div>
          <p class="mt-2 text-sm text-primary-theme">
            {{ space.qrcodes.length }} {{ t('张群码') }} · {{ t('来源项目用链接参数记录，无需创建') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Tag :variant="space.qrcodes.some((qr) => qr.serving) ? 'success' : 'warn'">
            {{ space.qrcodes.some((qr) => qr.serving) ? t('当前有可入群二维码') : t('当前展示公众号引导') }}
          </Tag>
          <Button
            variant="text-button"
            size="sm"
            icon="pi pi-trash"
            class="text-danger-500"
            :label="t('删除空间')"
            :loading="busyKey === 'space-delete'"
            :disabled="busyKey !== undefined"
            @click="removeSpace"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-0 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
      <div class="space-y-6 border-b border-primary-default p-5 xl:border-r xl:border-b-0">
        <section>
          <h3 class="font-semibold text-primary-title">{{ t('公开链接与来源参数') }}</h3>
          <p class="mt-1 text-xs leading-5 text-primary-theme">
            {{ t('链接永久不变。不同项目/渠道投放时加上 ?from= 参数即可区分来源，无需创建任何记录。') }}
          </p>
          <div class="mt-3 space-y-2">
            <div class="flex items-center gap-2 rounded-lg bg-primary-card p-3">
              <Input
                v-model="fromInput"
                class="min-w-0 flex-1"
                :placeholder="t('from 参数，如：ccdd / readme（可选）')"
                :invalid="fromInput.length > 0 && !fromValid"
              />
              <Button
                variant="text-button"
                size="sm"
                icon="pi pi-copy"
                :label="t('复制链接')"
                :disabled="!fromValid"
                @click="copyLink"
              />
            </div>
            <code class="block break-all rounded bg-primary-card px-3 py-2 text-xs text-primary-theme">{{
              publicSpaceUrl(space.name, fromInput.trim() || undefined)
            }}</code>
          </div>
        </section>

        <section class="border-t border-primary-default pt-5">
          <h3 class="font-semibold text-primary-title">{{ t('公众号引导（长期入口）') }}</h3>
          <p class="mt-1 text-xs leading-5 text-primary-theme">
            {{ t('群码失效或群满时，公开页以此为主要引导。每个空间独立配置。') }}
          </p>
          <form class="mt-3 space-y-2" @submit.prevent="saveOfficial">
            <Input
              v-model="officialName"
              class="w-full"
              :placeholder="t('公众号名称')"
              :disabled="busyKey === 'official-save'"
            />
            <Input
              v-model="replyKeyword"
              class="w-full"
              :placeholder="t('回复关键词，默认：加群')"
              :disabled="busyKey === 'official-save'"
            />
            <Textarea
              v-model="guideText"
              class="w-full"
              :rows="2"
              :placeholder="t('关注引导语（可选）')"
              :disabled="busyKey === 'official-save'"
            />
            <div class="flex flex-wrap items-center gap-3">
              <FileUpload
                accept="image/png,image/jpeg,image/webp"
                :choose-label="officialFile ? t('重新选择公众号码') : t('上传公众号二维码')"
                :disabled="busyKey === 'official-qr'"
                @select="selectOfficialFile"
              />
              <span class="text-xs text-primary-theme">PNG / JPEG / WebP · 5MB</span>
            </div>
            <div v-if="space.official.qrUrl" class="flex items-center gap-3 rounded-lg bg-primary-card p-3">
              <img
                :key="space.official.qrUrl"
                :src="officialAccountQrUrl(space.official.qrUrl)"
                :alt="t('公众号二维码')"
                class="h-16 w-16 rounded bg-white object-contain"
              />
              <span class="text-xs text-primary-theme">{{ t('当前公众号二维码') }}</span>
            </div>
            <div v-else class="flex items-center gap-3 rounded-lg bg-primary-card p-3">
              <span class="flex h-16 w-16 items-center justify-center rounded bg-primary-card"
                ><i class="pi pi-qrcode text-2xl text-primary-theme"
              /></span>
              <span class="text-xs text-primary-theme">{{ t('尚未上传公众号二维码') }}</span>
            </div>
            <div class="flex gap-2">
              <Button
                type="submit"
                size="sm"
                icon="pi pi-save"
                :label="t('保存公众号配置')"
                :loading="busyKey === 'official-save'"
                :disabled="!officialName.trim() || busyKey !== undefined"
              />
              <Button
                v-if="officialFile"
                size="sm"
                icon="pi pi-upload"
                :label="t('上传二维码')"
                :loading="busyKey === 'official-qr'"
                :disabled="busyKey !== undefined"
                @click="uploadOfficialQr"
              />
            </div>
          </form>
        </section>

        <section class="border-t border-primary-default pt-5">
          <h3 class="font-semibold text-primary-title">{{ t('上传微信群二维码') }}</h3>
          <p class="mt-1 text-xs leading-5 text-primary-theme">
            {{
              t(
                '新码进入等待队列，不会顶掉当前码。多个有效码按上传顺序出码；当前群标记已满后自动切下一个。默认有效期 7 天。',
              )
            }}
          </p>
          <form class="mt-3 space-y-3" @submit.prevent="uploadQr">
            <Input
              v-model="groupName"
              class="w-full"
              :placeholder="t('群名称，例如：交流群 2 群（可选）')"
              :disabled="uploading"
            />
            <Textarea
              v-model="note"
              class="w-full"
              :rows="2"
              :placeholder="t('备注，例如：备用群、换码原因（可选）')"
              :disabled="uploading"
            />
            <div class="flex flex-wrap items-center gap-3">
              <FileUpload
                accept="image/png,image/jpeg,image/webp"
                :choose-label="selectedFile ? t('重新选择群码') : t('选择群码图片')"
                :disabled="uploading"
                @select="selectFile"
              />
              <span class="text-xs text-primary-theme">PNG / JPEG / WebP · 5MB</span>
            </div>
            <div v-if="selectedFile" class="flex items-center gap-3 rounded-lg bg-primary-card p-3">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                :alt="t('待上传群码预览')"
                class="h-20 w-20 rounded bg-white object-contain"
              />
              <div class="min-w-0 flex-1 text-sm">
                <p class="truncate text-primary-title">{{ selectedFile.name }}</p>
                <p class="mt-1 text-xs text-primary-theme">{{ formatFileSize(selectedFile.size) }}</p>
              </div>
              <Button variant="text-button" size="sm" :label="t('移除')" @click="selectedFile = undefined" />
            </div>
            <Button
              type="submit"
              icon="pi pi-upload"
              :label="t('上传到群码池')"
              :loading="uploading"
              :disabled="!selectedFile || busyKey !== undefined"
            />
          </form>
        </section>
      </div>

      <section class="p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold text-primary-title">{{ t('群码池与出码顺序') }}</h3>
          <span class="text-xs text-primary-theme">{{ t('最早上传的有效码优先') }}</span>
        </div>
        <div v-if="sortedQrcodes.length" class="mt-4 space-y-3">
          <article
            v-for="(qr, index) in sortedQrcodes"
            :key="qr.id"
            class="rounded-lg border border-primary-default p-4"
            :class="qr.serving ? 'border-success-500 bg-success-50 dark:bg-success-950/20' : ''"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-primary-title">{{ qr.groupName || `${t('微信群码')} #${qr.id}` }}</span>
                  <Tag :variant="qrStatus(qr).variant">{{ qrStatus(qr).label }}</Tag>
                </div>
                <p class="mt-1 text-xs text-primary-theme">
                  {{
                    qr.serving
                      ? t('公开链接当前都展示这张码')
                      : qr.status === 'ACTIVE' && qr.effective
                        ? `${t('排队第')} ${waitingPosition(qr)} ${t('位')}`
                        : `${t('记录序号')} ${sortedQrcodes.length - index}`
                  }}
                </p>
              </div>
              <div class="flex flex-wrap gap-1">
                <Button
                  v-if="qr.status === 'ACTIVE' && qr.effective"
                  variant="text-button"
                  size="sm"
                  icon="pi pi-users"
                  :label="t('标记已满')"
                  :loading="busyKey === `qr-full-${qr.id}`"
                  :disabled="busyKey !== undefined"
                  @click="markFull(qr)"
                />
                <Button
                  v-if="qr.status === 'ACTIVE'"
                  variant="text-button"
                  size="sm"
                  icon="pi pi-ban"
                  :label="t('停用')"
                  :loading="busyKey === `qr-archived-${qr.id}`"
                  :disabled="busyKey !== undefined"
                  @click="archive(qr)"
                />
                <Button
                  v-if="qr.status !== 'ACTIVE'"
                  variant="text-button"
                  size="sm"
                  icon="pi pi-replay"
                  :label="t('重新排队')"
                  :loading="busyKey === `qr-active-${qr.id}`"
                  :disabled="busyKey !== undefined || new Date(qr.expiresAt).getTime() <= Date.now()"
                  @click="changeStatus(qr, 'ACTIVE')"
                />
              </div>
            </div>
            <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt class="inline text-primary-theme">{{ t('上传') }}：</dt>
                <dd class="inline text-primary-title">{{ formatDate(qr.uploadedAt) }}</dd>
              </div>
              <div>
                <dt class="inline text-primary-theme">{{ t('过期') }}：</dt>
                <dd class="inline text-primary-title">{{ formatDate(qr.expiresAt) }}</dd>
              </div>
              <div v-if="qr.note" class="sm:col-span-2">
                <dt class="inline text-primary-theme">{{ t('备注') }}：</dt>
                <dd class="inline text-primary-title">{{ qr.note }}</dd>
              </div>
            </dl>
          </article>
        </div>
        <div
          v-else
          class="mt-4 rounded-lg border border-dashed border-primary-default p-8 text-center text-sm text-primary-theme"
        >
          {{ t('尚未上传群码，公开链接当前展示公众号引导。') }}
        </div>
      </section>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useObjectUrl } from '@vueuse/core';
import { useAPI } from '@/api';
import { Button, Card, FileUpload, Input, Tag, Textarea } from '@/components/base';
import { useConfirm } from '@/composables/useConfirm';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { copyToClipboard } from '@/utils/clipboard';
import { getErrorMessage } from '@/utils/error';
import { formatDate, formatFileSize } from '@/utils/format';
import {
  ALLOWED_QR_FILE_TYPES,
  GROUP_FROM_PATTERN,
  MAX_QR_FILE_SIZE,
  officialAccountQrUrl,
  publicSpaceUrl,
  type SpaceQrCode,
  type GroupSpace,
} from './types';

const props = defineProps<{ space: GroupSpace }>();
const emit = defineEmits<{ changed: [] }>();
const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

/** 来源参数输入（空 = 不带 from 的基础链接） */
const fromInput = ref('');
const fromValid = computed(() => GROUP_FROM_PATTERN.test(fromInput.value.trim()));

/** 公众号配置表单（以空间当前值为初值） */
const officialName = ref(props.space.official.name);
const replyKeyword = ref(props.space.official.replyKeyword);
const guideText = ref(props.space.official.guideText ?? '');
const officialFile = shallowRef<File>();

const groupName = ref('');
const note = ref('');
const selectedFile = shallowRef<File>();
const previewUrl = useObjectUrl(selectedFile);
const uploading = ref(false);
const busyKey = ref<string>();
const sortedQrcodes = computed(() => [...props.space.qrcodes].reverse());

function qrStatus(qr: SpaceQrCode): { label: string; variant: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  if (qr.status === 'FULL') return { label: t('群已满'), variant: 'warn' };
  if (qr.status === 'ARCHIVED') return { label: t('已停用'), variant: 'secondary' };
  if (!qr.effective) return { label: t('已失效'), variant: 'danger' };
  if (qr.serving) return { label: t('当前出码'), variant: 'success' };
  return { label: t('等待出码'), variant: 'info' };
}

function waitingPosition(qr: SpaceQrCode): number {
  const waiting = props.space.qrcodes.filter((item) => item.status === 'ACTIVE' && item.effective && !item.serving);
  return waiting.findIndex((item) => item.id === qr.id) + 1;
}

async function copyLink() {
  try {
    await copyToClipboard(publicSpaceUrl(props.space.name, fromInput.value.trim() || undefined));
    toast.success(t('公开链接已复制'));
  } catch (error: unknown) {
    toast.error(t('复制失败'), getErrorMessage(error));
  }
}

async function saveOfficial() {
  if (!officialName.value.trim() || busyKey.value) return;
  busyKey.value = 'official-save';
  try {
    await API.groupEntryApi.updateOfficialAccount(
      props.space.id,
      officialName.value.trim(),
      replyKeyword.value.trim() || undefined,
      guideText.value.trim() || undefined,
    );
    toast.success(t('公众号配置已保存'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('保存公众号配置失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

function selectOfficialFile(event: { files: File[] }) {
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
  officialFile.value = file;
}

async function uploadOfficialQr() {
  if (!officialFile.value || busyKey.value) return;
  busyKey.value = 'official-qr';
  try {
    await API.groupEntryApi.uploadOfficialQr(officialFile.value, props.space.id);
    officialFile.value = undefined;
    toast.success(t('公众号二维码已更新'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('上传公众号二维码失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

async function removeSpace() {
  const accepted = await confirm.require({
    header: t('永久删除空间'),
    message: `${t('确定删除空间')}「${props.space.displayName || props.space.name}」${t('吗？将同时删除')} ${props.space.qrcodes.length} ${t('张群码，公开链接立即失效，且不可恢复。历史引流统计会保留。')}`,
    acceptLabel: t('永久删除空间'),
    acceptProps: { variant: 'danger' },
  });
  if (!accepted) return;
  busyKey.value = 'space-delete';
  try {
    await API.groupEntryApi.deleteSpace(props.space.id);
    toast.success(t('空间及其群码记录已删除'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('删除空间失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

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
}

async function uploadQr() {
  if (!selectedFile.value || uploading.value || busyKey.value) return;
  uploading.value = true;
  try {
    await API.groupEntryApi.upload(
      selectedFile.value,
      props.space.id,
      groupName.value.trim() || undefined,
      note.value.trim() || undefined,
    );
    selectedFile.value = undefined;
    groupName.value = '';
    note.value = '';
    toast.success(t('群码已加入空间池'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('上传群码失败'), getErrorMessage(error));
  } finally {
    uploading.value = false;
  }
}

async function changeStatus(qr: SpaceQrCode, status: 'FULL' | 'ARCHIVED' | 'ACTIVE') {
  busyKey.value = `qr-${status.toLowerCase()}-${qr.id}`;
  try {
    await API.groupEntryApi.setQrStatus(qr.id, status);
    toast.success(
      status === 'FULL'
        ? t('已标记群满，公开链接将自动切到下一张有效码')
        : status === 'ACTIVE'
          ? t('群码已重新进入等待队列')
          : t('群码已停用'),
    );
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('更新群码状态失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

async function markFull(qr: SpaceQrCode) {
  const accepted = await confirm.require({
    header: t('确认微信群已满'),
    message: t('确认后这张码停止出码，公开链接自动切到下一张有效群码。微信无法可靠自动探测群满，请在确认群满后操作。'),
    acceptLabel: t('确认已满'),
  });
  if (accepted) await changeStatus(qr, 'FULL');
}

async function archive(qr: SpaceQrCode) {
  const accepted = await confirm.require({
    header: t('停用群码'),
    message: t('停用后不再展示这张码，公开链接会切到下一张有效群码；没有有效码时展示公众号引导。'),
    acceptLabel: t('确认停用'),
    acceptProps: { variant: 'danger' },
  });
  if (accepted) await changeStatus(qr, 'ARCHIVED');
}
</script>
