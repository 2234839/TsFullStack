<template>
  <div class="template-component">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const title = ref('Template Component')
const description = ref('This is a reusable template component')
</script>

<style scoped>
.template-component {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
}
</style>