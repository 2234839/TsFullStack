<template>
  <div>{{ t('重定向中') }}...</div>
</template>

<script setup lang="ts">
  import { routeMap, routerUtil } from '@/router';
  import { onMounted } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { useRouter } from 'vue-router';

  const router = useRouter();
  const { t } = useI18n();
  const props = defineProps<{ path?: string }>();
  onMounted(() => {
    const path = props.path;

    if (path && typeof path === 'string') {
      router.replace({ path });
    } else {
      routerUtil.push(routeMap.index, {});
    }
  });
</script>
