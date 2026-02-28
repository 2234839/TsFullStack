<style scoped></style>
<template>
  <div class="h-48 bg-gray-100 dark:bg-gray-700">
    <Carousel :value="data.data.files" :numVisible="1" :numScroll="1" :circular="true">
      <template #item="{ data: fileData }: { data: ShareFileJSON }">
        <div class="h-40 mt-1">
          <ShareFilePreview :file="fileData" />
        </div>
      </template>
    </Carousel>
  </div>
</template>
<script setup lang="ts">
  import { Carousel } from '@/components/base';
  import { type ShareFileJSON, type ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';

  defineProps({
    data: {
      type: null as unknown as () => ShareItemJSON,
      required: true,
    },
  });
</script>
