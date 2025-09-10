// Frontend composables
import { ref, computed } from 'vue';

export const useCounter = () => {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);
  
  const increment = () => count.value++;
  const decrement = () => count.value--;
  const reset = () => count.value = 0;
  
  return {
    count,
    doubleCount,
    increment,
    decrement,
    reset
  };
};

export const useAsync = <T>(asyncFunction: () => Promise<T>) => {
  const data = ref<T | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  
  const execute = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      data.value = await asyncFunction();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };
  
  return {
    data,
    error,
    loading,
    execute
  };
};