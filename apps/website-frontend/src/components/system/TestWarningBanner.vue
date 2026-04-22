<template>
  <div
    v-if="showTestWarn && visible"
    class="fixed top-0 left-0 right-0 bg-warning-600/80 p-2.5 text-center z-[1000] flex justify-center items-center gap-2.5 text-sm">
    <span class="font-bold"
      >这是测试账号，仅供测试使用!! 数据会不定时清空，请另外注册帐号使用。
    </span>
    <Button variant="ghost" @click="close">
      关闭
    </Button>
    <Button
      variant="ghost"
      @click="gotoLogin({ r: $route.fullPath })">
      去登录/注册新帐号
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { gotoLogin } from '@/pages/loginUtil';
  import { authInfo } from '@/storage';
  import { computed, ref } from 'vue';
  import { Button } from '@/components/base';
  const showTestWarn = computed(() => {
    return !!authInfo.value?.user.role.find((el) => el.name === '测试角色');
  });
  const visible = ref(true);

  const close = () => {
    visible.value = false;
  };
</script>
