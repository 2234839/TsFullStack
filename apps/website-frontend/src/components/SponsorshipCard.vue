<template>
  <div
    ref="containerRef"
    class="sponsor-card w-full h-full min-h-0 relative overflow-hidden transition-all duration-500 ease-out hover:shadow-lg hover:shadow-primary-200/50 dark:hover:shadow-primary-800/30 cursor-pointer group"
    :class="[isCompact ? 'rounded-lg' : isStandard ? 'rounded-xl' : 'rounded-none']">
    <!-- 紧凑模式 - 小正方形 -->
    <div
      v-if="isCompact"
      class="compact-layout relative w-full h-full min-h-[80px] flex flex-col items-center justify-center bg-white dark:bg-primary-900 border border-primary-200 dark:border-primary-700">
      <!-- 柔和的背景装饰 -->
      <div class="absolute inset-0 opacity-30">
        <div
          class="absolute top-2 left-2 w-2 h-2 bg-warning-300/60 rounded-full animate-pulse"></div>
        <div
          class="absolute bottom-3 right-3 w-1.5 h-1.5 bg-primary-300/60 rounded-full animate-pulse delay-1000"></div>
      </div>

      <div class="compact-heart relative mb-1 z-10">
        <div class="text-xl text-primary-600 dark:text-primary-300">☕</div>
      </div>
      <div
        class="compact-text text-xs font-medium mb-2 z-10 text-center text-primary-700 dark:text-primary-300">
        {{ t('赞助支持') }}
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="compact-btn! w-7! h-7!"
        @click="showQRCode = true"
      >
        <i class="pi pi-heart text-xs"></i>
      </Button>
    </div>

    <!-- 标准模式 - 中等尺寸 -->
    <div
      v-else-if="isStandard"
      class="standard-layout relative w-full h-full min-h-[280px] overflow-hidden bg-white dark:bg-primary-900">
      <!-- 柔和的装饰元素 -->
      <div class="absolute inset-0 opacity-20">
        <div class="absolute top-4 right-4 w-8 h-8 border border-primary-300/50 rounded-full"></div>
        <div class="absolute bottom-4 left-4 w-4 h-4 bg-warning-200/60 rounded-lg rotate-45"></div>
      </div>

      <div class="standard-content relative z-10 p-5 h-full flex flex-col justify-between">
        <div class="standard-header">
          <div class="floating-hearts absolute -top-0.5 -right-0.5">
            <div class="text-lg">☕</div>
          </div>

          <h3 class="standard-title text-lg font-semibold mb-2 text-primary-800 dark:text-primary-200">
            {{ t('请我喝杯咖啡') }}
          </h3>
          <p
            class="standard-subtitle text-sm text-primary-600 dark:text-primary-400 mb-4 leading-relaxed">
            {{ t('您的每一份支持都是创作路上最温暖的陪伴') }}
          </p>
        </div>

        <!-- 主要操作按钮 -->
        <div class="standard-actions flex gap-2 mb-3">
          <Button
            variant="primary"
            class="action-btn! flex-1!"
            @click="showQRCode = true"
          >
            <i class="pi pi-qrcode mr-1.5 text-xs"></i>
            {{ t('扫码支持') }}
          </Button>
          <Button
            variant="secondary"
            class="action-btn! flex-1!"
            @click="handleDirectPay"
          >
            <i class="pi pi-external-link mr-1.5 text-xs"></i>
            {{ t('其他方式') }}
          </Button>
        </div>

        <!-- 功能按钮组 -->
        <div class="function-buttons flex justify-center gap-3">
          <Button
            variant="ghost"
            class="function-btn! flex-col! items-center! p-2!"
            @click="shareContent"
          >
            <i class="pi pi-share-alt text-sm text-primary-500 mb-1"></i>
            <span class="text-xs text-primary-600 dark:text-primary-400">{{ t('分享') }}</span>
          </Button>
          <Button
            variant="ghost"
            class="function-btn! flex-col! items-center! p-2!"
            @click="followCreator"
          >
            <i class="pi pi-heart text-sm text-danger-500 mb-1"></i>
            <span class="text-xs text-primary-600 dark:text-primary-400">{{ t('关注') }}</span>
          </Button>
          <Button
            variant="ghost"
            class="function-btn! flex-col! items-center! p-2!"
            @click="provideFeedback"
          >
            <i class="pi pi-comment text-sm text-success-500 mb-1"></i>
            <span class="text-xs text-primary-600 dark:text-primary-400">{{ t('反馈') }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- 展开模式 - 长条形 -->
    <div
      v-else
      class="expanded-layout relative w-full h-full min-h-[160px] overflow-hidden bg-white dark:bg-primary-900">
      <!-- 柔和的装饰 -->
      <div
        class="absolute top-4 left-4 w-12 h-12 border border-primary-200/50 rounded-full opacity-30"></div>
      <div
        class="absolute bottom-4 right-4 w-6 h-6 bg-warning-100/60 rounded-lg rotate-45 opacity-40"></div>

      <div class="expanded-content relative z-10 p-5 h-full flex items-center justify-between">
        <div class="expanded-left flex items-center space-x-4 flex-1">
          <!-- 创作者头像 -->
          <div class="creator-avatar relative">
            <div
              class="avatar-ring w-12 h-12 rounded-full border-2 border-primary-300 bg-white/80 backdrop-blur-sm flex items-center justify-center text-xl dark:border-primary-500 dark:bg-primary-700/80">
              🎨
            </div>
            <div
              class="avatar-status absolute -bottom-1 -right-1 w-4 h-4 bg-success-400 rounded-full border-2 border-white flex items-center justify-center">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>

          <div class="creator-info flex-1">
            <h3 class="creator-title text-lg font-semibold mb-1 text-primary-800 dark:text-primary-200">
              {{ t('支持独立创作者') }}
            </h3>
            <p
              class="creator-desc text-sm text-primary-600 dark:text-primary-400 mb-2 leading-relaxed max-w-md">
              {{ t('每一份支持都是对原创内容最好的鼓励') }}
            </p>

            <!-- 支持者显示 -->
            <div class="supporter-info flex items-center space-x-2">
              <div class="supporter-avatars flex -space-x-1">
                <div
                  v-for="i in Math.min(sponsorCount, 3)"
                  :key="i"
                  class="supporter-avatar w-5 h-5 bg-primary-200 rounded-full border border-white flex items-center justify-center text-xs dark:bg-primary-600">
                  {{ ['👤', '👩', '👨'][i % 3] }}
                </div>
                <div
                  v-if="sponsorCount > 3"
                  class="supporter-more w-5 h-5 bg-primary-300 rounded-full border border-white flex items-center justify-center text-xs font-bold dark:bg-primary-500">
                  +
                </div>
              </div>
              <span class="supporter-text text-sm text-primary-500 dark:text-primary-400">
                {{ sponsorCount }} {{ t('位朋友已支持') }}
              </span>
            </div>
          </div>
        </div>

        <div class="expanded-right flex items-center">
          <!-- 操作按钮 -->
          <div class="expanded-actions flex space-x-2 mr-3">
            <Button
              variant="primary"
              class="expanded-btn!"
              @click="showQRCode = true"
            >
              <i class="pi pi-qrcode mr-1.5"></i>
              {{ t('支持') }}
            </Button>
          </div>

          <!-- 功能按钮组 -->
          <div class="function-buttons-expanded flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              class="function-btn-small!"
              :title="t('分享推荐')"
              @click="shareContent"
            >
              <i class="pi pi-share-alt text-sm text-primary-500"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="function-btn-small!"
              :title="t('关注作者')"
              @click="followCreator"
            >
              <i class="pi pi-heart text-sm text-danger-500"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="function-btn-small!"
              :title="t('意见反馈')"
              @click="provideFeedback"
            >
              <i class="pi pi-comment text-sm text-success-500"></i>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 简化的二维码弹窗 -->
    <Dialog
      v-model:open="showQRCode"
      :title="t('感谢您的支持')">
      <div class="qr-content space-y-4">
        <!-- 二维码展示区 -->
        <div class="qr-display flex justify-center">
          <img src="/afdian-崮生.webp" class="max-w-full h-96 rounded-lg shadow-md" />
        </div>

        <!-- 感谢信息 -->
        <div class="thank-you-section">
          <div
            class="thank-you-message flex items-start space-x-3 p-4 bg-primary-50 dark:bg-primary-900 rounded-lg border border-primary-200 dark:border-primary-700">
            <div class="message-icon text-2xl">🙏</div>
            <div>
              <p class="text-sm text-primary-700 dark:text-primary-300 leading-relaxed font-medium mb-1">
                {{ t('感谢您的慷慨支持！您的每一份心意都是我继续创作的动力源泉') }}
              </p>
              <p class="text-xs text-primary-500 dark:text-primary-400">
                {{ t('支持创作，让美好持续发生 ✨') }}
              </p>
            </div>
          </div>
        </div>

        <!-- QQ群引导 -->
        <div
          class="community-invite bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-700">
          <div class="flex items-center space-x-3">
            <div class="community-icon text-xl">👥</div>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-primary-800 dark:text-primary-200 mb-1">
                {{ t('加入创作者社群') }}
              </h4>
              <p class="text-xs text-primary-600 dark:text-primary-400 mb-2">
                {{ t('与其他支持者交流，获取最新创作动态') }}
              </p>
              <Button
                variant="primary"
                size="sm"
                class="inline-flex! items-center!"
                @click="joinQQGroup"
              >
                <i class="pi pi-users mr-1"></i>
                {{ t('加入QQ群') }} {{ qqGroupNumber }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { useSharePlus } from '@/utils/hooks/useSharePlus';
  import { useElementSize } from '@vueuse/core';
  import { Dialog } from '@tsfullstack/shared-frontend/components';
  import { Button } from '@/components/base';
  import { computed, ref, useTemplateRef } from 'vue';
  import { useI18n } from '@/composables/useI18n';

  const { t } = useI18n();

  interface Props {
    compactThreshold?: number;
    expandedThreshold?: number;
    sponsorCount?: number;
    totalAmount?: number;
    targetAmount?: number;
    qqGroupNumber?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    compactThreshold: 120,
    expandedThreshold: 500,
    sponsorCount: 1,
    totalAmount: 30,
    targetAmount: 5000,
    qqGroupNumber: '706761641',
  });

  const showQRCode = ref(false);
  const containerRef = useTemplateRef('containerRef');
  const { width: containerWidth } = useElementSize(containerRef);

  const isCompact = computed(() => containerWidth.value < props.compactThreshold);
  const isStandard = computed(
    () =>
      containerWidth.value >= props.compactThreshold &&
      containerWidth.value < props.expandedThreshold,
  );

  const handleDirectPay = () => {
    window.open('https://afdian.com/a/llej0', '_blank');
  };

  const joinQQGroup = () => {
    const qqGroupUrl = `https://qm.qq.com/cgi-bin/qm/qr?k=${props.qqGroupNumber}&jump_from=webapi`;
    window.open(qqGroupUrl, '_blank');
  };

  const { share } = useSharePlus();
  const shareContent = () => {
    share({
      title: '支持独立创作者',
      text: '发现了一个很棒的创作者，一起来支持吧！',
      url: window.location.href,
    });
  };

  const followCreator = () => {
    window.open('https://github.com/2234839', '_blank');
  };

  const provideFeedback = () => {
    window.open('https://github.com/2234839/TsFullStack/issues', '_blank');
  };
</script>

<style scoped>
  /* 柔和的悬停效果 */
  .sponsor-card:hover .creator-avatar {
    transform: scale(1.02);
  }

  .action-btn:hover,
  .expanded-btn:hover {
    transform: translateY(-1px);
  }

  .function-btn:hover,
  .function-btn-small:hover {
    transform: translateY(-1px);
  }

  /* 响应式优化 */
  @media (max-width: 640px) {
    .expanded-content {
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .expanded-left {
      gap: 0.75rem;
    }

    .function-buttons-expanded {
      justify-content: center;
      margin-top: 0.5rem;
    }

    .qr-dialog {
      width: 90vw !important;
      max-width: 380px !important;
    }
  }

  /* 深色模式优化 */
  .dark .qr-display {
    background: linear-gradient(135deg, var(--color-gray-700) 0%, var(--color-gray-800) 100%);
  }
</style>
