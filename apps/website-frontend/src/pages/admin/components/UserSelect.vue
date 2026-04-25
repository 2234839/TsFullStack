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
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/utils/error';

const { t } = useI18n();
const toast = useToast();

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

const { modelValue, multiple = false, maxSelection = 5, placeholder = '' } = defineProps<Props>()

const emit = defineEmits<Emits>();

const { API } = useAPI();
const users = shallowRef<Array<{ id: string; email: string }>>([]);
const userOptions = shallowRef<{ label: string; value: string }[]>([]);

const selectedUsers = computed({
  get: () => {
    if (multiple) {
      if (Array.isArray(modelValue)) {
        return modelValue;
      }
      return modelValue ? [modelValue] : [];
    } else {
      if (Array.isArray(modelValue)) {
        return modelValue.length > 0 ? modelValue[0] : '';
      }
      return modelValue ?? '';
    }
  },
  set: (value) => {
    if (multiple) {
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

/** 加载用户列表 */
const loadUsers = async () => {
  try {
    const result = await API.db.user.findMany({
      orderBy: { id: 'asc' },
      take: 500,
    });

    users.value = result;
    userOptions.value = result.map(user => ({
      label: `${user.email} (${user.id})`,
      value: user.id
    }));
  } catch (error: unknown) {
    toast.error(t('加载用户列表失败'), getErrorMessage(error));
  }
};

/** 处理选择变化 */
const handleChange = (event: { value: unknown }) => {
  const value = event.value;
  if (multiple) {
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

// 监听 modelValue 变化
watch(() => modelValue, (newValue) => {
  if (multiple) {
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
});

onMounted(loadUsers);
</script>