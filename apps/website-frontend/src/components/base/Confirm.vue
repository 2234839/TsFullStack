<script setup lang="ts">
/**
 * 确认对话框组件
 * 替代 PrimeVue 的 ConfirmPopup
 */
import { useConfirmState } from '@/composables/useConfirm';
import Button from './Button.vue';

const { confirmState } = useConfirmState();

/** 确认处理 */
function handleAccept() {
  confirmState.value._accept?.();
}

/** 拒绝处理 */
function handleReject() {
  confirmState.value._reject?.();
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div
        v-if="confirmState.show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
          @click.stop>
          <!-- 标题 -->
          <div v-if="confirmState.header" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {{ confirmState.header }}
          </div>

          <!-- 图标和消息 -->
          <div class="flex items-start gap-4 mb-6">
            <div v-if="confirmState.icon" class="shrink-0">
              <i :class="confirmState.icon" class="text-2xl text-warning-500" />
            </div>
            <div class="flex-1">
              <p class="text-gray-700 dark:text-gray-300">
                {{ confirmState.message }}
              </p>
            </div>
          </div>

          <!-- 按钮 -->
          <div class="flex justify-end gap-3">
            <Button
              :label="confirmState.rejectLabel || '取消'"
              variant="secondary"
              @click="handleReject" />
            <Button
              :label="confirmState.acceptLabel || '确认'"
              :class="confirmState.acceptClass"
              @click="handleAccept" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
