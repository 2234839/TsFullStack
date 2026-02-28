<style scoped></style>
<template>
  <div class="user-select">
    <MultiSelect
      v-model="selectedUsers"
      :options="userOptions"
      :placeholder="placeholder"
      :maxSelectedLabels="maxSelection"
      :selectionLimit="multiple ? maxSelection : 1"
      :display="multiple ? 'chip' : 'comma'"
      :filter="true"
      :filterFields="['label', 'value']"
      :filterPlaceholder="t('搜索用户')"
      optionLabel="label"
      optionValue="value"
      class="w-full"
      @change="handleChange" />
  </div>
</template>

<script setup lang="ts">
import { MultiSelect } from '@/components/base';
import { computed, onMounted, ref, watch } from 'vue';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

interface Props {
  modelValue?: string | string[] | null;
  multiple?: boolean;
  maxSelection?: number;
  placeholder?: string;
  filter?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string | string[] | null): void;
  (e: 'change', value: string | string[] | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  maxSelection: 5,
  placeholder: '',
  filter: true
});

const emit = defineEmits<Emits>();

const { API } = useAPI();
const users = ref<any[]>([]);
const userOptions = ref<{ label: string; value: string }[]>([]);

const selectedUsers = computed({
  get: () => {
    if (props.multiple) {
      if (Array.isArray(props.modelValue)) {
        return props.modelValue;
      }
      return props.modelValue ? [props.modelValue] : [];
    } else {
      if (Array.isArray(props.modelValue)) {
        return props.modelValue.length > 0 ? props.modelValue[0] : null;
      }
      return props.modelValue || null;
    }
  },
  set: (value) => {
    if (props.multiple) {
      const newValue = Array.isArray(value) ? value : value ? [value] : [];
      const finalValue = newValue.length > 0 ? newValue : null;
      emit('update:modelValue', finalValue);
      emit('change', finalValue);
    } else {
      const newValue = Array.isArray(value) ? (value.length > 0 ? value[0] : null) : value;
      const finalValue = newValue || null;
      emit('update:modelValue', finalValue);
      emit('change', finalValue);
    }
  }
});

// 加载用户列表
const loadUsers = async () => {
  try {
    const result = await API.db.user.findMany({
      orderBy: { id: 'asc' }
    });

    users.value = result;
    userOptions.value = result.map(user => ({
      label: `${user.email} (${user.id})`,
      value: user.id
    }));
  } catch (error) {
    console.error('加载用户列表失败:', (error as Error).message);
  }
};

// 处理选择变化
const handleChange = (event: any) => {
  const value = event.value;
  if (props.multiple) {
    const newValue = Array.isArray(value) ? value : value ? [value] : [];
    const finalValue = newValue.length > 0 ? newValue : null;
    emit('update:modelValue', finalValue);
    emit('change', finalValue);
  } else {
    const newValue = Array.isArray(value) ? (value.length > 0 ? value[0] : null) : value;
    const finalValue = newValue || null;
    emit('update:modelValue', finalValue);
    emit('change', finalValue);
  }
};

// 监听 props.modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (props.multiple) {
    if (Array.isArray(newValue)) {
      const validValues = newValue.filter(v => userOptions.value.some(opt => opt.value === v));
      if (validValues.length !== newValue.length) {
        emit('update:modelValue', validValues.length > 0 ? validValues : null);
      }
    }
  } else {
    if (newValue && !userOptions.value.some(opt => opt.value === newValue)) {
      emit('update:modelValue', null);
    }
  }
}, { deep: true });

onMounted(() => {
  loadUsers();
});
</script>