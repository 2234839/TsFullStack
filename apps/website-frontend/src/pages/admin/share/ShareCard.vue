<style scoped></style>
<template>
  <div class="h-48 bg-gray-100 dark:bg-gray-700">
    <Carousel :value="data.data.files" :numVisible="1" :numScroll="1">
      <template #item="{ data }: { data: ShareFileJSON }">
        <div class="h-40 mt-1">
          <ShareFilePreview :file="data" />
        </div>
      </template>
    </Carousel>
  </div>
</template>
<script setup lang="ts">
  import { type ShareFileJSON, type ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';

  defineProps({
    data: {
      type: null as unknown as () => ShareItemJSON,
      required: true,
    },
  });
</script>
