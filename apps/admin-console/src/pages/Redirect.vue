<template>
  <div>{{ t('重定向中') }}...</div>
</template>

<script setup lang="ts">
  import { routeMap, routerUtil } from '@/router';
  import { onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useRouter } from 'vue-router';

  const router = useRouter();
  const { t } = useI18n();
  const props = defineProps<{ path?: string }>();
  onMounted(() => {
    const path = props.path;

    if (path && typeof path === 'string') {
      router.replace({ path });
    } else {
      console.error('Invalid redirect path:', path);
      // 可选：重定向到默认路由或显示错误信息
      routerUtil.push(routeMap.index, undefined);
    }
  });
</script>
