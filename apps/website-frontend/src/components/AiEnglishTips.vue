<template>
  <div class="mb-4 p-3 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
    <div class="flex flex-col sm:flex-row items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300">
      <i :class="`pi ${icon} text-sm!`" />
      <span class="font-medium">{{ title }}</span>
      <span>{{ tips }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  tips: string
  title: string
  icon: string
}

defineProps<Props>()
</script>