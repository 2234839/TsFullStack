<style scoped></style>
<template>
  <div class="h-48 bg-gray-100 dark:bg-gray-700">
    <Carousel :value="data.data.files" :numVisible="1" :numScroll="1">
      <template #item="{ data }: { data: ShareFileJSON }">
        <File2Url :fileId="data.id" v-slot="{ url }">
          <img :src="url" class="h-40 mt-1" />
        </File2Url>
      </template>
    </Carousel>
  </div>
</template>
<script setup lang="ts">
  import File2Url from '@/pages/admin/components/File2Url.vue';
  import {
    getFileTypeIcon,
    type ShareFileJSON,
    type ShareItemJSON,
  } from '@/pages/admin/share/ShareDef';

  const props = defineProps({
    data: {
      type: null as unknown as () => ShareItemJSON,
      required: true,
    },
  });
</script>
