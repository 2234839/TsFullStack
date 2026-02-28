<template>
  <div
    v-if="showTestWarn && visible"
    class="fixed top-0 left-0 right-0 bg-warning-300/80 p-2.5 text-center z-[1000] flex justify-center items-center gap-2.5 text-sm">
    <span class="font-bold"
      >这是测试账号，仅供测试使用!! 数据会不定时清空，请另外注册帐号使用。
    </span>
    <button @click="close" class="bg-transparent border border-black p-0.5 px-2 cursor-pointer">
      关闭
    </button>
    <button
      @click="gotoLogin({ r: $route.fullPath })"
      class="bg-transparent border border-black p-0.5 px-2 cursor-pointer">
      去登录/注册新帐号
    </button>
  </div>
</template>

<script setup lang="ts">
  import { gotoLogin } from '@/pages/loginUtil';
  import { authInfo } from '@/storage';
  import { computed, ref } from 'vue';
  const showTestWarn = computed(() => {
    return !!authInfo.value?.user.role.find((el) => el.name === '测试角色');
  });
  const visible = ref(true);

  const close = () => {
    visible.value = false;
  };
</script>
