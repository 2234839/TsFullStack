<template>
  <Card class="overflow-hidden">
    <div class="border-b border-primary-default p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-xl font-semibold text-primary-title">{{ project.displayName || project.name }}</h2>
            <code class="rounded bg-primary-card px-2 py-1 text-xs text-primary-theme">{{ project.name }}</code>
          </div>
          <p class="mt-2 text-sm text-primary-theme">
            {{ project.entries.length }} {{ t('个公开入口') }} · {{ project.qrcodes.length }} {{ t('张群码') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Tag :variant="project.qrcodes.some((qr) => qr.serving) ? 'success' : 'warn'">
            {{ project.qrcodes.some((qr) => qr.serving) ? t('当前有可入群二维码') : t('当前展示公众号引导') }}
          </Tag>
          <Button
            variant="text-button"
            size="sm"
            icon="pi pi-trash"
            class="text-danger-500"
            :label="t('删除项目')"
            :loading="busyKey === 'project-delete'"
            :disabled="busyKey !== undefined"
            @click="removeProject"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-0 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <div class="space-y-6 border-b border-primary-default p-5 xl:border-r xl:border-b-0">
        <section>
          <h3 class="font-semibold text-primary-title">{{ t('公开入口') }}</h3>
          <p class="mt-1 text-xs leading-5 text-primary-theme">
            {{ t('同一项目的不同入口共享群码池，可分别投放到不同项目或渠道并独立统计。') }}
          </p>
          <ul class="mt-3 space-y-2">
            <li v-for="entry in project.entries" :key="entry.id" class="rounded-lg bg-primary-card p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <code class="text-sm font-medium text-primary-title">/group/{{ entry.key }}</code>
                <div class="flex items-center">
                  <Button
                    variant="text-button"
                    size="sm"
                    icon="pi pi-copy"
                    :label="t('复制链接')"
                    @click="copyEntry(entry.key)"
                  />
                  <a
                    :href="publicEntryUrl(entry.key)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-2 py-1 text-sm text-info-600 hover:underline dark:text-info-400"
                    >{{ t('打开') }}</a
                  >
                  <Button
                    variant="text-button"
                    size="sm"
                    icon="pi pi-trash"
                    :label="t('删除')"
                    :loading="busyKey === `entry-${entry.id}`"
                    :disabled="busyKey !== undefined"
                    @click="removeEntry(entry)"
                  />
                </div>
              </div>
              <p v-if="entry.note" class="mt-1 text-xs text-primary-theme">{{ entry.note }}</p>
            </li>
          </ul>
          <form class="mt-3 space-y-2" @submit.prevent="addEntry">
            <Input
              v-model="newEntryKey"
              class="w-full"
              placeholder="new-entry"
              :invalid="newEntryKey.length > 0 && !newEntryValid"
            />
            <div class="flex gap-2">
              <Input v-model="newEntryNote" class="min-w-0 flex-1" :placeholder="t('投放位置备注（可选）')" />
              <Button
                type="submit"
                size="sm"
                icon="pi pi-plus"
                :label="t('新增入口')"
                :loading="busyKey === 'new-entry'"
                :disabled="!newEntryValid || busyKey !== undefined"
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
                      ? t('所有公开入口当前都展示这张码')
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
          {{ t('尚未上传群码，公开入口当前展示公众号引导。') }}
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
  GROUP_ENTRY_KEY_PATTERN,
  MAX_QR_FILE_SIZE,
  publicEntryUrl,
  type ProjectEntry,
  type ProjectQrCode,
  type GroupProject,
} from './types';

const props = defineProps<{ project: GroupProject }>();
const emit = defineEmits<{ changed: [] }>();
const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const newEntryKey = ref('');
const newEntryNote = ref('');
const groupName = ref('');
const note = ref('');
const selectedFile = shallowRef<File>();
const previewUrl = useObjectUrl(selectedFile);
const uploading = ref(false);
const busyKey = ref<string>();
const newEntryValid = computed(() => GROUP_ENTRY_KEY_PATTERN.test(newEntryKey.value.trim().toLowerCase()));
const sortedQrcodes = computed(() => [...props.project.qrcodes].reverse());

function qrStatus(qr: ProjectQrCode): { label: string; variant: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  if (qr.status === 'FULL') return { label: t('群已满'), variant: 'warn' };
  if (qr.status === 'ARCHIVED') return { label: t('已停用'), variant: 'secondary' };
  if (!qr.effective) return { label: t('已失效'), variant: 'danger' };
  if (qr.serving) return { label: t('当前出码'), variant: 'success' };
  return { label: t('等待出码'), variant: 'info' };
}

function waitingPosition(qr: ProjectQrCode): number {
  const waiting = props.project.qrcodes.filter((item) => item.status === 'ACTIVE' && item.effective && !item.serving);
  return waiting.findIndex((item) => item.id === qr.id) + 1;
}

async function copyEntry(key: string) {
  try {
    await copyToClipboard(publicEntryUrl(key));
    toast.success(t('公开入口链接已复制'));
  } catch (error: unknown) {
    toast.error(t('复制失败'), getErrorMessage(error));
  }
}

async function addEntry() {
  if (!newEntryValid.value || busyKey.value) return;
  busyKey.value = 'new-entry';
  try {
    await API.groupEntryApi.createEntry(
      props.project.id,
      newEntryKey.value.trim().toLowerCase(),
      newEntryNote.value.trim() || undefined,
    );
    newEntryKey.value = '';
    newEntryNote.value = '';
    toast.success(t('公开入口已创建'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('创建入口失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

async function removeEntry(entry: ProjectEntry) {
  const accepted = await confirm.require({
    header: t('删除公开入口'),
    message: `${t('确定删除')} /group/${entry.key} ${t('吗？该入口将展示公众号引导，项目和其他入口不受影响。')}`,
    acceptLabel: t('确认删除'),
    acceptProps: { variant: 'danger' },
  });
  if (!accepted) return;
  busyKey.value = `entry-${entry.id}`;
  try {
    await API.groupEntryApi.deleteEntry(entry.id);
    toast.success(t('入口已删除'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('删除入口失败'), getErrorMessage(error));
  } finally {
    busyKey.value = undefined;
  }
}

async function removeProject() {
  const accepted = await confirm.require({
    header: t('永久删除项目'),
    message: `${t('确定删除项目')}「${props.project.displayName || props.project.name}」${t('吗？将同时删除')} ${props.project.entries.length} ${t('个入口和')} ${props.project.qrcodes.length} ${t('张群码，公开链接立即失效，且不可恢复。历史引流统计会保留。')}`,
    acceptLabel: t('永久删除项目'),
    acceptProps: { variant: 'danger' },
  });
  if (!accepted) return;
  busyKey.value = 'project-delete';
  try {
    await API.groupEntryApi.deleteProject(props.project.id);
    toast.success(t('项目及其入口、群码记录已删除'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('删除项目失败'), getErrorMessage(error));
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
      props.project.id,
      groupName.value.trim() || undefined,
      note.value.trim() || undefined,
    );
    selectedFile.value = undefined;
    groupName.value = '';
    note.value = '';
    toast.success(t('群码已加入项目池'));
    emit('changed');
  } catch (error: unknown) {
    toast.error(t('上传群码失败'), getErrorMessage(error));
  } finally {
    uploading.value = false;
  }
}

async function changeStatus(qr: ProjectQrCode, status: 'FULL' | 'ARCHIVED' | 'ACTIVE') {
  busyKey.value = `qr-${status.toLowerCase()}-${qr.id}`;
  try {
    await API.groupEntryApi.setQrStatus(qr.id, status);
    toast.success(
      status === 'FULL'
        ? t('已标记群满，公开入口将自动切到下一张有效码')
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

async function markFull(qr: ProjectQrCode) {
  const accepted = await confirm.require({
    header: t('确认微信群已满'),
    message: t(
      '确认后这张码停止出码，所有项目入口自动切到下一张有效群码。微信无法可靠自动探测群满，请在确认群满后操作。',
    ),
    acceptLabel: t('确认已满'),
  });
  if (accepted) await changeStatus(qr, 'FULL');
}

async function archive(qr: ProjectQrCode) {
  const accepted = await confirm.require({
    header: t('停用群码'),
    message: t('停用后不再展示这张码，公开入口会切到下一张有效群码；没有有效码时展示公众号引导。'),
    acceptLabel: t('确认停用'),
    acceptProps: { variant: 'danger' },
  });
  if (accepted) await changeStatus(qr, 'ARCHIVED');
}
</script>
