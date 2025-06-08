<style scoped></style>
<template>
  <!-- 展示广告位 -->
  <ins
    class="adsbygoogle"
    style="display: block"
    data-ad-client="ca-pub-7181140659254262"
    data-ad-slot="8223616080"
    data-ad-format="auto"
    data-full-width-responsive="true"></ins>
</template>
<script setup lang="ts">
  import { onMounted } from 'vue';

  onMounted(() => {
    // @ts-expect-error
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
</script>
