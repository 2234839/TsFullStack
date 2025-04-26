<template>
  <div>{{ t('重定向中') }}...</div>
</template>

<script setup lang="ts">
  import { useRouter, useRoute } from 'vue-router';
  import { onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';

  const router = useRouter();
  const route = useRoute();
  const { t } = useI18n();
  onMounted(() => {
    const { query } = route;
    const { path } = query;

    if (path && typeof path === 'string') {
      router.replace({ path });
    } else {
      console.error('Invalid redirect path:', path);
      // 可选：重定向到默认路由或显示错误信息
      router.replace({ path: '/' }); // 示例：重定向到首页
    }
  });
</script>
