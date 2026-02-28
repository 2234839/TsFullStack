<template>
  <div class="group fixed bottom-4 right-4 z-50">
    <div class="relative button-container">
      <!-- 大按钮 -->
      <a
        v-show="githubStarShow !== 'hide'"
        href="https://github.com/2234839/TsFullStack"
        target="_blank"
        class="github-button large-button flex items-center gap-2 px-4 py-3 bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
        :class="{
          'button-show': githubStarShow !== 'hide',
          'button-hide': githubStarShow === 'hide',
        }">
        <i class="pi pi-github text-2xl!" />
        <i class="pi pi-star-fill text-2xl! text-warning-300" />
        <span class="font-medium button-text"> {{ t('支持一下 | Star 这个项目') }} </span>
        <button
          @click.prevent.stop="toggleGithubStar()"
          class="hidden group-hover:block absolute -top-2 -right-2 bg-white text-gray-800 rounded-full p-1 leading-none shadow-md hover:bg-gray-100 transition-colors">
          <i class="pi pi-times text-sm" />
        </button>
      </a>

      <!-- 小按钮 -->
      <button
        v-show="githubStarShow === 'hide'"
        @click="toggleGithubStar()"
        class="small-button -rotate-12 fixed -bottom-3 -right-3 flex items-center justify-center w-12 h-12 bg-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        :class="{
          'button-show': githubStarShow === 'hide',
          'button-hide': githubStarShow !== 'hide',
        }">
        <i class="pi pi-github text-white text-4xl!" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { githubStarShow } from '@/storage'
  import { useI18n } from 'vue-i18n';

  const { t } = useI18n();

  const toggleGithubStar = () => {
    githubStarShow.value = githubStarShow.value === 'hide' ? 'show' : 'hide';
  };
</script>

<style scoped>
  .button-container {
    position: relative;
    min-height: 3rem; /* 确保容器高度足够 */
    min-width: 3rem; /* 确保容器宽度足够 */
  }

  .large-button {
    /* 不设置固定宽度，让它自适应内容 */
    white-space: nowrap; /* 防止文本换行 */
  }

  /* 按钮显示状态 */
  .button-show {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }

  /* 按钮隐藏状态 */
  .button-hide {
    opacity: 0;
    pointer-events: none;
  }

  /* 大按钮隐藏时的样式 */
  .large-button.button-hide {
    transform: scale(0.5);
    border-radius: 9999px;
    width: 3rem;
    height: 3rem;
    overflow: hidden;
  }

  /* 文字淡入淡出 */
  .button-text {
    transition: opacity 0.2s ease;
  }

  .large-button.button-hide .button-text {
    opacity: 0;
  }
</style>
