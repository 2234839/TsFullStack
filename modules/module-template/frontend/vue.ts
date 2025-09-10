// Vue-specific components and utilities
import { defineComponent } from 'vue';

export const TemplateComponent = defineComponent({
  name: 'TemplateComponent',
  setup() {
    return () => 'Template Component';
  }
});

export * from './composables';