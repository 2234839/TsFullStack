<style scoped></style>
<template>
  <div class="bg-primary-100 dark:bg-primary-700">
    <Carousel :value="data.data.files" :numVisible="1" :numScroll="1" :circular="true">
      <template #item="{ data: fileData }">
        <div class="h-48 w-full">
          <ShareFilePreview :file="fileData as ShareFileJSON" />
        </div>
      </template>
    </Carousel>
  </div>
</template>
<script setup lang="ts">
  import { Carousel } from '@/components/base';
  import { type ShareFileJSON, type ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';

  interface ShareCardProps {
    data: ShareItemJSON;
  }

  defineProps<ShareCardProps>();
</script>
