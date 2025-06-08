<template>
  <div class="inline-block relative">
    <div ref="__triggerRef" @click="handleTriggerClick">
      <slot name="trigger"></slot>
    </div>

    <Teleport to="body">
      <Transition name="popover-fade">
        <div
          v-if="isOpen"
          ref="__floatingRef"
          class="bg-[var(--p-dialog-background)] z-[10001] absolute rounded shadow-lg max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)]"
          :style="floatingStyles">
          <div
            ref="__arrowRef"
            class="absolute w-3 h-3 bg-[var(--p-dialog-background)] transform rotate-45 z-[-1]"
            :style="arrowStyles" />
          <div class="relative p-3">
            <div
              v-if="showCloseIcon"
              class="absolute top-2 right-2 w-5 h-5 flex items-center justify-center cursor-pointer text-base text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-700"
              @click="close">
              ×
            </div>
            <slot></slot>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { arrow, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue';
  import { onClickOutside, useEventListener } from '@vueuse/core';
  import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';

  const props = defineProps({
    offsetDistance: {
      type: Number,
      default: 8,
    },
    trigger: {
      type: String,
      default: 'click',
      validator: (value: string) => ['click', 'hover', 'manual'].includes(value),
    },
    showCloseIcon: {
      type: Boolean,
      default: false,
    },
    closeOnClickOutside: {
      type: Boolean,
      default: true,
    },
    modelValue: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits(['update:modelValue']);

  // 引用和状态
  const triggerRef = useTemplateRef('__triggerRef');
  const floatingRef = useTemplateRef('__floatingRef');
  const arrowRef = useTemplateRef('__arrowRef');
  const isOpen = ref(props.modelValue);

  // 监听modelValue变化
  const updateIsOpen = (value: boolean) => {
    isOpen.value = value;
    emit('update:modelValue', value);
  };

  // 使用useFloating进行定位
  const { floatingStyles, middlewareData, update } = useFloating(triggerRef, floatingRef, {
    middleware: [
      offset(props.offsetDistance),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // 箭头样式
  const arrowStyles = computed(() => {
    if (!middlewareData.value.arrow) {
      return {};
    }

    const { x, y } = middlewareData.value.arrow;
    const placement = middlewareData.value.flip?.overflows?.[0].placement || 'top';
    return {
      left: x != null ? `${x}px` : '',
      top: y != null ? `${y}px` : '',
      [placement]: '-6px',
    };
  });

  // 打开/关闭方法
  const open = () => {
    updateIsOpen(true);
    // 确保位置更新
    setTimeout(() => {
      update && update();
    }, 0);
  };

  const close = () => {
    updateIsOpen(false);
  };

  const toggle = () => {
    isOpen.value ? close() : open();
  };

  // 点击触发器
  const handleTriggerClick = () => {
    if (props.trigger === 'click') {
      toggle();
    }
  };

  // 悬停处理
  if (props.trigger === 'hover') {
    onMounted(() => {
      useEventListener(triggerRef, 'mouseenter', open);
      useEventListener(triggerRef, 'mouseleave', () => {
        // 给用户时间移动到popover上
        setTimeout(() => {
          if (!floatingRef.value?.contains(document.activeElement)) {
            close();
          }
        }, 100);
      });

      useEventListener(floatingRef, 'mouseenter', open);
      useEventListener(floatingRef, 'mouseleave', close);
    });
  }

  // 点击外部关闭
  onClickOutside(floatingRef, () => {
    if (!props.closeOnClickOutside) {
      return;
    }
    if (isOpen.value) {
      close();
    }
  });
  // 监听modelValue变化
  watch(
    () => props.modelValue,
    (value) => {
      isOpen.value = value;
    },
  );

  // 监听isOpen变化
  watch(isOpen, (value) => {
    emit('update:modelValue', value);
  });

  // 暴露方法
  defineExpose({
    open,
    close,
    toggle,
  });
</script>

<style scoped></style>
