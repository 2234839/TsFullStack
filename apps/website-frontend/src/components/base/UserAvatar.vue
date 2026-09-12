<template>
  <div
    class="user-avatar rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-secondary-100 dark:bg-secondary-800"
    :class="avatarClass"
  >
    <File2Url v-if="fileId" :fileId="fileId" v-slot="{ url, loading }">
      <div v-if="loading" class="w-full h-full flex items-center justify-center">
        <i class="pi pi-spinner pi-spin text-secondary-400 dark:text-secondary-500"></i>
      </div>
      <img v-else :src="url" :alt="t('用户头像')" class="w-full h-full object-cover" />
    </File2Url>
    <!-- 未设置头像时的兜底：中性用户图标 -->
    <i
      v-else
      class="pi pi-user text-secondary-400 dark:text-secondary-500"
      :class="iconClass"
      :aria-label="t('默认头像')"
    ></i>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import File2Url from "@/pages/admin/components/File2Url.vue";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

/** 用户头像文件的 File ID，为空时显示默认图标 */
const props = defineProps<{
  fileId?: string | null;
  /** 尺寸档位：sm=32px(贴文场景)，md=48px(侧边栏)，lg=64px(设置页) */
  size?: "sm" | "md" | "lg";
}>();

/** 尺寸 → 容器类 */
const avatarClass = computed(() => {
  return { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" }[props.size ?? "md"];
});

/** 尺寸 → 图标字号 */
const iconClass = computed(() => {
  return { sm: "!text-sm", md: "!text-xl", lg: "!text-2xl" }[props.size ?? "md"];
});
</script>
