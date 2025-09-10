// Frontend Vue components
<template>
  <div class="loading-spinner" :class="{ 'small': small }">
    <div class="spinner"></div>
    <span v-if="text" class="text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string;
  small?: boolean;
}>();
</script>

<style scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
}

.loading-spinner.small {
  padding: 0.5rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small .spinner {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.text {
  font-size: 0.875rem;
  color: #666;
}
</style>