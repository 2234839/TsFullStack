<template>
  <RouterLink :to="routePath" class="group block">
    <div class="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer h-64">
      <!-- 背景图片 -->
      <img
        :alt="title"
        :src="imageUrl"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <!-- 渐变遮罩 - 从透明到深色 -->
      <div class="absolute inset-0 bg-gradient-to-t from-primary-950/90 via-primary-950/40 to-transparent" />
      <!-- 内容区域 -->
      <div class="absolute inset-0 p-6 flex flex-col justify-end">
        <h3 class="text-2xl font-bold text-primary-50 mb-2 drop-shadow-lg">{{ title }}</h3>
        <p v-if="longDescription" class="text-primary-200 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-md line-clamp-2">
          {{ longDescription }}
        </p>
      </div>
      <!-- 悬停时的微妙边框高亮 -->
      <div class="absolute inset-0 border-2 border-primary-50/0 group-hover:border-primary-50/30 rounded-xl transition-colors duration-300 pointer-events-none" />
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

interface Props {
  title: string;
  imageUrl: string;
  routePath: RouteLocationRaw;
  longDescription?: string;
}

const { title, imageUrl, routePath, longDescription } = defineProps<Props>();
</script>
