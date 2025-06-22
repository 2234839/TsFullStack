<style scoped></style>
<template>
  <div class="flex gap-0.5 items-center">
    <ThemeToggle />
    <I18nSwitch />
    <UserSettingBtn />
  </div>
</template>
<script setup lang="ts">
  import ThemeToggle from '@/components/system/ThemeToggle.vue';
  import UserSettingBtn from '@/components/system/UserSettingBtn.vue';
  import I18nSwitch from '@/components/system/I18nSwitch.vue';
</script>
