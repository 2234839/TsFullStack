<template>
  <div
    ref="containerRef"
    class="sponsor-card w-full h-full min-h-0 relative overflow-hidden transition-all duration-500 ease-out hover:shadow-2xl hover:shadow-purple-500/25 dark:hover:shadow-purple-400/20 cursor-pointer group"
    :class="[isCompact ? 'rounded-xl' : 'rounded-2xl']">
    <!-- 紧凑模式 - 小正方形 -->
    <div
      v-if="isCompact"
      class="compact-layout relative w-full h-full min-h-[80px] flex flex-col items-center justify-center bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600 dark:from-rose-500 dark:via-pink-600 dark:to-purple-700 text-white">
      <!-- 背景装饰 -->
      <div class="absolute inset-0 opacity-20 dark:opacity-30">
        <div
          class="absolute top-2 left-2 w-3 h-3 bg-white dark:bg-yellow-300 rounded-full animate-ping"></div>
        <div
          class="absolute bottom-3 right-3 w-2 h-2 bg-yellow-300 dark:bg-white rounded-full animate-pulse"></div>
        <div
          class="absolute top-1/2 left-1 w-1 h-1 bg-white dark:bg-yellow-200 rounded-full animate-bounce"></div>
      </div>

      <div class="compact-heart relative mb-1 z-10">
        <div class="heart-pulse text-3xl animate-bounce">💖</div>
        <div
          class="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 dark:bg-yellow-300 rounded-full animate-ping"></div>
      </div>
      <div class="compact-text text-xs font-bold mb-2 z-10">{{ $t('赞助支持') }}</div>
      <button
        @click="showQRCode = true"
        class="compact-btn w-7 h-7 bg-white/20 dark:bg-white/30 backdrop-blur-sm border border-white/30 dark:border-white/40 text-white rounded-full hover:bg-white/30 dark:hover:bg-white/40 hover:scale-110 transition-all duration-300 flex items-center justify-center z-10">
        <i class="pi pi-plus text-xs"></i>
      </button>
    </div>

    <!-- 标准模式 - 中等尺寸 -->
    <div
      v-else-if="isStandard"
      class="standard-layout relative w-full h-full min-h-[220px] overflow-hidden">
      <!-- 动态背景 -->
      <div
        class="standard-bg absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 dark:from-indigo-600 dark:via-purple-700 dark:to-pink-700"></div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/20 dark:from-black/40 via-transparent to-white/10 dark:to-white/5"></div>

      <!-- 装饰元素 -->
      <div class="absolute inset-0 opacity-30 dark:opacity-40">
        <div
          class="absolute top-4 right-4 w-16 h-16 border-2 border-white/20 dark:border-white/30 rounded-full animate-spin-slow"></div>
        <div
          class="absolute bottom-6 left-6 w-8 h-8 bg-white/10 dark:bg-white/20 rounded-lg rotate-45 animate-pulse"></div>
        <div
          class="absolute top-1/2 right-8 w-4 h-4 bg-yellow-400/60 dark:bg-yellow-300/70 rounded-full animate-bounce"></div>
      </div>

      <div
        class="standard-content relative z-10 p-6 h-full flex flex-col justify-between text-white">
        <div class="standard-header">
          <!-- 浮动表情 -->
          <div class="floating-hearts absolute -top-2 -right-2">
            <div class="heart heart-1 absolute text-xl animate-float-1">☕</div>
            <div class="heart heart-2 absolute text-lg animate-float-2 left-4">✨</div>
            <div class="heart heart-3 absolute text-lg animate-float-3 left-8 top-2">💝</div>
          </div>

          <h3
            class="standard-title text-2xl font-bold mb-2 bg-gradient-to-r from-white to-yellow-200 dark:from-white dark:to-yellow-100 bg-clip-text text-transparent">
            {{ $t('请我喝杯咖啡') }}
          </h3>
          <p class="standard-subtitle text-sm opacity-90 dark:opacity-95 mb-6 leading-relaxed">
            {{ $t('您的每一份支持都是创作路上最温暖的陪伴') }}
          </p>
        </div>

        <!-- 进度环 -->
        <div class="progress-section flex items-center justify-center mb-6">
          <div class="progress-ring relative w-24 h-24">
            <svg class="progress-svg w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                class="progress-bg fill-none stroke-white/20 dark:stroke-white/30"
                stroke-width="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                class="progress-fill fill-none stroke-white dark:stroke-yellow-200 transition-all duration-1000 ease-out"
                stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray="264"
                :style="{ strokeDashoffset: progressOffset }" />
            </svg>
            <div
              class="progress-content absolute inset-0 flex flex-col items-center justify-center">
              <span class="progress-amount text-lg font-bold">¥{{ totalAmount }}</span>
              <span class="progress-label text-xs opacity-80 dark:opacity-90">{{
                $t('已筹集')
              }}</span>
            </div>
            <!-- 进度环光效 -->
            <div
              class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/30 to-transparent animate-spin-slow opacity-50"></div>
          </div>
        </div>

        <div class="standard-actions flex gap-3">
          <button
            @click="showQRCode = true"
            class="action-btn primary-btn flex-1 font-medium py-3 px-4 rounded-xl bg-white dark:bg-gray-100 text-purple-600 dark:text-purple-700 hover:bg-gray-100 dark:hover:bg-gray-200 hover:shadow-lg transition-all duration-300 flex items-center justify-center shadow-lg">
            <i class="pi pi-qrcode mr-2"></i>
            {{ $t('扫码支持') }}
          </button>
          <button
            @click="handleDirectPay"
            class="action-btn secondary-btn flex-1 font-medium py-3 px-4 rounded-xl border-2 border-white dark:border-white/80 text-white hover:bg-white/10 dark:hover:bg-white/20 hover:shadow-lg transition-all duration-300 flex items-center justify-center">
            <i class="pi pi-credit-card mr-2"></i>
            {{ $t('在线支付') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 展开模式 - 长条形 -->
    <div v-else class="expanded-layout relative w-full h-full min-h-[160px] overflow-hidden">
      <!-- 复杂背景 -->
      <div class="expanded-bg absolute inset-0">
        <div
          class="bg-pattern absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-700 dark:via-purple-700 dark:to-pink-700"></div>
        <div
          class="bg-overlay absolute inset-0 bg-gradient-to-br from-transparent via-white/5 dark:via-white/10 to-black/20 dark:to-black/30"></div>
        <!-- 动态几何图形 -->
        <div
          class="absolute top-4 left-4 w-20 h-20 border border-white/20 dark:border-white/30 rounded-full animate-pulse"></div>
        <div
          class="absolute bottom-4 right-4 w-12 h-12 bg-white/10 dark:bg-white/20 rounded-lg rotate-45 animate-bounce"></div>
        <div
          class="absolute top-1/2 left-1/4 w-6 h-6 bg-yellow-400/30 dark:bg-yellow-300/40 rounded-full animate-ping"></div>
      </div>

      <div
        class="expanded-content relative z-10 p-6 h-full flex items-center justify-between text-white">
        <div class="expanded-left flex items-center space-x-6 flex-1">
          <!-- 创作者头像 -->
          <div class="creator-avatar relative">
            <div
              class="avatar-ring w-20 h-20 rounded-full border-4 border-white/30 dark:border-white/40 animate-pulse-ring"></div>
            <div
              class="avatar-content absolute inset-1 bg-gradient-to-br from-white/20 dark:from-white/30 to-white/10 dark:to-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl">
              🎨
            </div>
            <div
              class="avatar-status absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 dark:bg-green-300 rounded-full border-3 border-white dark:border-gray-100 animate-pulse flex items-center justify-center">
              <div class="w-2 h-2 bg-white dark:bg-gray-100 rounded-full"></div>
            </div>
            <!-- 头像光环 -->
            <div
              class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 dark:via-white/20 to-transparent animate-spin-slow"></div>
          </div>

          <div class="creator-info flex-1">
            <h3
              class="creator-title text-2xl font-bold mb-3 bg-gradient-to-r from-white via-yellow-200 dark:via-yellow-100 to-white bg-clip-text text-transparent">
              {{ $t('支持独立创作者') }}
            </h3>
            <p
              class="creator-desc text-sm opacity-90 dark:opacity-95 mb-4 leading-relaxed max-w-md">
              {{
                $t(
                  '每一份支持都是对原创内容最好的鼓励，让我们一起创造更美好的数字世界，您的慷慨将点亮创作之路',
                )
              }}
            </p>

            <!-- 支持者列表 -->
            <div class="supporter-list flex items-center space-x-3">
              <div class="supporter-avatars flex -space-x-2">
                <div
                  v-for="i in Math.min(sponsorCount, 6)"
                  :key="i"
                  class="supporter-avatar w-8 h-8 bg-gradient-to-br from-white/20 dark:from-white/30 to-white/10 dark:to-white/20 rounded-full border-2 border-white dark:border-gray-100 flex items-center justify-center text-xs backdrop-blur-sm"
                  :style="{ animationDelay: `${i * 0.1}s` }">
                  {{ ['👤', '👩', '👨', '🧑', '👱', '👶'][i % 6] }}
                </div>
                <div
                  v-if="sponsorCount > 6"
                  class="supporter-more w-8 h-8 bg-white/30 dark:bg-white/40 rounded-full border-2 border-white dark:border-gray-100 flex items-center justify-center text-xs font-bold backdrop-blur-sm">
                  +{{ sponsorCount - 6 }}
                </div>
              </div>
              <span class="supporter-text text-sm opacity-80 dark:opacity-90 font-medium">
                {{ sponsorCount }} {{ $t('位朋友已支持') }}
              </span>
            </div>
          </div>
        </div>

        <div class="expanded-right flex flex-col space-y-4">
          <!-- 统计卡片 -->
          <div class="stats-container flex space-x-4">
            <div
              v-if="0"
              class="stat-card bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[90px] border border-white/20 dark:border-white/30 hover:bg-white/20 dark:hover:bg-white/30 transition-all duration-300">
              <div class="stat-icon text-3xl mb-2">💰</div>
              <div class="stat-value text-xl font-bold">¥{{ totalAmount }}</div>
              <div class="stat-label text-xs opacity-80 dark:opacity-90">{{ $t('总支持') }}</div>
            </div>
            <div
              class="stat-card bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[90px] border border-white/20 dark:border-white/30 hover:bg-white/20 dark:hover:bg-white/30 transition-all duration-300">
              <div class="stat-icon text-3xl mb-2"><i class="pi pi-users" /></div>
              <div class="stat-value text-xl font-bold">{{ sponsorCount }}</div>
              <div class="stat-label text-xs opacity-80 dark:opacity-90">{{ $t('支持者') }}</div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="expanded-actions flex space-x-3">
            <button
              @click="showQRCode = true"
              class="expanded-btn primary-expanded font-medium px-8 py-3 rounded-xl bg-white dark:bg-gray-100 text-purple-600 dark:text-purple-700 hover:bg-gray-100 dark:hover:bg-gray-200 hover:shadow-xl transition-all duration-300 flex items-center shadow-xl">
              <i class="pi pi-qrcode mr-2"></i>
              {{ $t('立即支持') }}
            </button>
            <button
              @click="handleDirectPay"
              class="expanded-btn secondary-expanded font-medium px-6 py-3 rounded-xl border-2 border-white dark:border-white/80 text-white hover:bg-white/10 dark:hover:bg-white/20 hover:shadow-lg transition-all duration-300 flex items-center">
              <i class="pi pi-external-link mr-2"></i>
              {{ $t('其他方式') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 精美二维码弹窗 -->
    <Dialog
      v-model:visible="showQRCode"
      :header="$t('感谢')"
      modal
      class="qr-dialog"
      :style="{ width: '450px' }">
      <div class="qr-content space-y-6">

        <!-- 二维码展示区 -->
        <div class="qr-display max-h-[60vh] h-90 flex justify-center">
          <img  src="/afdian-崮生.webp" />
        </div>

        <!-- 感谢信息 -->
        <div
          class="thank-you-message flex items-start space-x-4 p-6 bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 dark:from-pink-900/20 dark:via-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-700">
          <div class="message-icon text-3xl animate-bounce">🙏</div>
          <div>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
              {{ $t('感谢您的慷慨支持！您的每一份心意都是我继续创作的动力源泉') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {{ $t('支持创作，让美好持续发生 ✨') }}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import Dialog from 'primevue/dialog';

  interface Props {
    compactThreshold?: number;
    expandedThreshold?: number;
    sponsorCount?: number;
    totalAmount?: number;
    targetAmount?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    compactThreshold: 120,
    expandedThreshold: 500,
    sponsorCount: 0,
    totalAmount: 0,
    targetAmount: 0,
  });

  const containerWidth = ref(0);
  const showQRCode = ref(false);
  const activeTab = ref<'afdian' | 'alipay'>('afdian');
  const selectedAmount = ref(20);
  const customAmount = ref('');
  const containerRef = ref<HTMLElement>();

  const amounts = [5, 10, 20, 50, 100, 200];

  const isCompact = computed(() => containerWidth.value < props.compactThreshold);
  const isStandard = computed(
    () =>
      containerWidth.value >= props.compactThreshold &&
      containerWidth.value < props.expandedThreshold,
  );

  const progressOffset = computed(() => {
    const progress = Math.min(props.totalAmount / props.targetAmount, 1);
    const circumference = 2 * Math.PI * 42;
    return circumference - progress * circumference;
  });

  const handleDirectPay = () => {
    window.open('https://afdian.com/a/llej0', '_blank');
  };

  const resizeObserver = ref<ResizeObserver>();

  onMounted(() => {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.offsetWidth;

      resizeObserver.value = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerWidth.value = entry.contentRect.width;
        }
      });

      resizeObserver.value.observe(containerRef.value);
    }
  });

  onUnmounted(() => {
    if (resizeObserver.value) {
      resizeObserver.value.disconnect();
    }
  });
</script>

<style scoped>
  /* 自定义动画 */
  @keyframes float-1 {
    0%,
    100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0.8;
    }
    50% {
      transform: translateY(-15px) rotate(10deg);
      opacity: 1;
    }
  }

  @keyframes float-2 {
    0%,
    100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0.6;
    }
    50% {
      transform: translateY(-12px) rotate(-8deg);
      opacity: 1;
    }
  }

  @keyframes float-3 {
    0%,
    100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0.7;
    }
    50% {
      transform: translateY(-18px) rotate(15deg);
      opacity: 1;
    }
  }

  @keyframes pulse-ring {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes scan {
    0% {
      transform: translateY(-100%);
    }
    100% {
      transform: translateY(200px);
    }
  }

  .animate-float-1 {
    animation: float-1 3s ease-in-out infinite;
  }
  .animate-float-2 {
    animation: float-2 4s ease-in-out infinite;
  }
  .animate-float-3 {
    animation: float-3 3.5s ease-in-out infinite;
  }
  .animate-pulse-ring {
    animation: pulse-ring 2s ease-in-out infinite;
  }
  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }
  .animate-scan {
    animation: scan 2s ease-in-out infinite;
  }

  /* 响应式调整 */
  @media (max-width: 640px) {
    .expanded-content {
      flex-direction: column;
      gap: 1rem;
    }

    .expanded-left {
      gap: 0.75rem;
    }

    .stats-container {
      justify-content: center;
    }

    .amount-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
