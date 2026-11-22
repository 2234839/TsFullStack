<!-- ABOUTME: 登录浮层 — Dialog 内嵌 LoginForm(stayOnSuccess)，支持账密/OAuth/微信口令，登录成功不导航不丢草稿，可嵌入任意页面 -->
<template>
  <Dialog v-model:open="open" :title="t('登录')">
    <div class="space-y-3">
      <LoginForm stay-on-success @success="handleSuccess" />
      <p class="text-center text-xs text-primary-subtle">
        {{ t('登录后将自动继续当前操作，您的编辑内容不会丢失') }}
      </p>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog } from '@tsfullstack/shared-frontend/components';
import LoginForm from '@/components/common/LoginForm.vue';
import { useI18n } from '@/composables/useI18n';

/** 浮层开关（v-model:open） */
const open = defineModel<boolean>('open', { default: false });

/** 登录成功（调用方在此继续被登录打断的操作，如自动提交表单） */
const emit = defineEmits<{ success: [] }>();

const { t } = useI18n();

function handleSuccess() {
  open.value = false;
  emit('success');
}
</script>
