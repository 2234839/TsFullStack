<script setup lang="ts">
/**
 * 确认对话框组件
 * 替代 PrimeVue 的 ConfirmPopup
 * 支持两种模式：
 * 1. 全屏居中模式（没有传入 event）
 * 2. Popover 模式（传入 event，使用 reka-ui Popover 在元素附近显示）
 */
import { useConfirmState } from '@/composables/useConfirm';
import { useI18n } from '@/composables/useI18n';
import Button from './Button.vue';
import { PopoverRoot, PopoverPortal, PopoverContent, PopoverArrow, PopoverAnchor } from 'reka-ui';
import { computed } from 'vue';

const { t } = useI18n();

const { confirmState } = useConfirmState();

/** Popover anchor 位置 */
const anchorPosition = computed(() => {
  if (!confirmState.value.targetElement) return { x: 0, y: 0 };
  const rect = confirmState.value.targetElement.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom,
  };
});

/** 确认处理 */
function handleAccept() {
  confirmState.value._accept?.();
}

/** 拒绝处理 */
function handleReject() {
  confirmState.value._reject?.();
}

/** Popover 关闭处理 */
function handleOpenChange(open: boolean) {
  if (!open) {
    handleReject();
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- 全屏居中模式 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div
        v-if="confirmState.show && !confirmState.targetElement"
        class="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/50">
        <div
          class="bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
          @click.stop>
          <!-- 标题 -->
          <div v-if="confirmState.header" class="text-lg font-semibold text-primary-950 dark:text-primary-50 mb-4">
            {{ confirmState.header }}
          </div>

          <!-- 图标和消息 -->
          <div class="flex items-start gap-4 mb-6">
            <div v-if="confirmState.icon" class="shrink-0">
              <i :class="confirmState.icon" class="text-2xl text-warning-600 dark:text-warning-400" />
            </div>
            <div class="flex-1">
              <p class="text-primary-800 dark:text-primary-200">
                {{ confirmState.message }}
              </p>
            </div>
          </div>

          <!-- 按钮 -->
          <div class="flex justify-end gap-3">
            <Button
              :label="confirmState.rejectLabel || t('取消')"
              variant="secondary"
              @click="handleReject" />
            <Button
              :label="confirmState.acceptLabel || t('确认')"
              :class="confirmState.acceptClass"
              @click="handleAccept" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Popover 模式（使用 reka-ui） -->
    <PopoverRoot
      v-if="confirmState.targetElement && confirmState.show"
      :open="confirmState.show"
      @update:open="handleOpenChange">
      <!-- 隐藏的 anchor 元素用于定位 -->
      <div
        ref="anchorRef"
        class="fixed w-px h-px pointer-events-none invisible"
        :style="{
          left: `${anchorPosition.x}px`,
          top: `${anchorPosition.y}px`,
        }">
        <PopoverAnchor />
      </div>
      <PopoverPortal>
        <PopoverContent
          :side="'bottom'"
          :side-offset="8"
          :align="'center'"
          :avoid-collisions="true"
          class="z-50 bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
          @click.stop>
          <!-- 箭头 -->
          <PopoverArrow class="fill-primary-50 dark:fill-primary-900 border border-primary-200 dark:border-primary-700 border-b-0" />

          <!-- 标题 -->
          <div v-if="confirmState.header" class="text-lg font-semibold text-primary-950 dark:text-primary-50 mb-4">
            {{ confirmState.header }}
          </div>

          <!-- 图标和消息 -->
          <div class="flex items-start gap-4 mb-6">
            <div v-if="confirmState.icon" class="shrink-0">
              <i :class="confirmState.icon" class="text-2xl text-warning-600 dark:text-warning-400" />
            </div>
            <div class="flex-1">
              <p class="text-primary-800 dark:text-primary-200">
                {{ confirmState.message }}
              </p>
            </div>
          </div>

          <!-- 按钮 -->
          <div class="flex justify-end gap-3">
            <Button
              :label="confirmState.rejectLabel || t('取消')"
              variant="secondary"
              @click="handleReject" />
            <Button
              :label="confirmState.acceptLabel || t('确认')"
              :class="confirmState.acceptClass"
              @click="handleAccept" />
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </Teleport>
</template>
