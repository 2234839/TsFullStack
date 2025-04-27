<style scoped></style>
<template>
  <div class="test">123456</div>
</template>
<script setup lang="ts">
  import { onMounted } from '#imports';
  import { authStoreLoadingPromise } from '@/storage/auth';
  import { API } from '@/utils/api';
  onMounted(async () => {
    console.log(3333);
    await authStoreLoadingPromise;
    API.db.user.findMany().then((users) => {
      console.log('[users]', users);
    });
  });
</script>
