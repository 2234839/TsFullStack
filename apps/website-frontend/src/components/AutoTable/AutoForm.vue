<template>
  <Dialog
    v-model:open="visible"
    :title="t('新增记录')"
    @close="resetForm">
    <div class="p-fluid min-w-72 max-w-[50vw]">
      <div v-for="field in formFields" :key="field.name" class="field col-12 md:col-6 mb-4">
        <label :for="'field-' + field.name" class="block text-sm font-medium mb-1">
          <span class="font-bold">{{ field.name }}</span>
          <span v-if="isRequiredField(field)" class="text-danger-500">*</span>
          <Tooltip :content="JSON.stringify(field, null, 2)" side="top">
            <span class="text-xs text-primary-400 ml-1">
              {{ field.type }}{{ field.isArray ? '[ ]' : '' }}
            </span>
          </Tooltip>
          <span v-for="attr of field.attributes" class="text-xs text-gray-500 ml-1">{{
            attr.name
          }}</span>
        </label>

        <div>
          <AutoColumnEdit
            :row="formData"
            :field="field"
            :cellData="undefined"
            v-model="formData[field.name]" />
          <small v-if="fieldErrors[field.name]" class="text-danger-500 block mt-1">{{
            fieldErrors[field.name]
          }}</small>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        :label="t('取消')"
        variant="text"
        @click="visible = false" />
      <Button :label="t('保存')" @click="saveRecord" :loading="saving" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import AutoColumnEdit from '@/components/AutoTable/AutoColumnEdit.vue';
  import { Button } from '@/components/base';
  import { Dialog } from '@tsfullstack/shared-frontend/components';
  import { Tooltip } from '@tsfullstack/shared-frontend/components';
  import { useToast } from '@/composables/useToast';
  import { computed, onMounted, reactive, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';
  import type { DBmodelNames, FieldInfo, ModelMeta } from './type';
  import { findIdField } from './util';
  import type { RelationSelectData } from '@/components/AutoTable/RelationSelect.vue';

  const { t } = useI18n();
  const toast = useToast();
  const { API } = useAPI();

  const props = defineProps<{
    modelKey: string;
    modelMeta: ModelMeta;
  }>();
  const selectModel = computed(() => props.modelMeta.models[props.modelKey]);
  const modelFields = computed(() => selectModel.value?.fields || {});
  const emit = defineEmits(['created', 'update:visible']);

  // 表单状态
  const visible = ref(false);
  const saving = ref(false);
  const formData = reactive<Record<string, any>>({});
  const fieldErrors = ref<Record<string, string>>({});

  // 计算属性：表单字段
  const formFields = computed(() => {
    return Object.values(modelFields.value).filter((field) => {
      // 排除自动生成的ID字段和不可编辑的字段
      return !(field.isId && field.isAutoIncrement);
    });
  });

  // 判断字段是否必填
  function isRequiredField(field: FieldInfo) {
    if (hasDefaultAttr(field)) return false;
    if (hasUpdatedAtAttr(field)) return false;
    if (field.isArray) return false;
    return !field.isOptional && !field.defaultValueProvider && !field.isId;
  }
  function hasDefaultAttr(field: FieldInfo) {
    return field.attributes?.some((attr) => attr.name === '@default');
  }
  function hasUpdatedAtAttr(field: FieldInfo) {
    return field.attributes?.some((attr) => attr.name === '@updatedAt');
  }
  // 重置表单
  function resetForm() {
    Object.values(modelFields.value).forEach((field) => {
      delete formData[field.name];
    });
    fieldErrors.value = {};
  }

  // 验证表单
  function validateForm() {
    fieldErrors.value = {};
    let isValid = true;

    formFields.value.forEach((field: FieldInfo) => {
      // 检查必填字段
      if (
        isRequiredField(field) &&
        (formData[field.name] === undefined ||
          formData[field.name] === null ||
          formData[field.name] === '')
      ) {
        fieldErrors.value[field.name] = t('此字段为必填项');
        isValid = false;
      }
    });

    return isValid;
  }

  async function saveRecord() {
    if (!validateForm() || !props.modelKey) return;

    saving.value = true;

    try {
      // 准备数据，处理关系字段
      const data: Record<string, any> = {};

      for (const field of formFields.value) {
        const fieldName = field.name;
        const value = formData[fieldName];

        // 跳过未设置的可选字段
        if (field.isOptional && (value === undefined || value === null || value === '')) {
          continue;
        }

        // 处理关系字段
        if (field.isDataModel && props.modelMeta && value) {
          const relationData = value as RelationSelectData;

          const idField = findIdField(props.modelMeta, field.type);
          if (idField) {
            data[fieldName] = {
              connect: relationData.add.map((item) => ({
                [idField.name]: item.value,
              })),
              // 因为是新增数据，所以不用处理断开的情况
            };
          }
        } else {
          data[fieldName] = value;
        }
      }
      // 创建记录
      const result = await API.db[props.modelKey as DBmodelNames].create({
        // @ts-ignore
        data,
      });

      toast.add({
        severity: 'success',
        summary: t('成功'),
        detail: t('记录创建成功'),
        life: 3000,
      });

      emit('created', result);
      visible.value = false;
    } catch (error: any) {
      console.error('Failed to create record:', error);

      toast.add({
        severity: 'error',
        summary: t('错误'),
        detail: error.message || t('创建记录失败'),
        life: 5000,
      });
    } finally {
      saving.value = false;
    }
  }

  // 监听visible变化
  watch(
    () => visible.value,
    (newValue) => {
      emit('update:visible', newValue);
    },
  );

  // 打开对话框
  function open() {
    resetForm();
    visible.value = true;
  }

  onMounted(() => {
    // 在组件挂载后不再自动加载关系数据
  });

  // 导出方法供父组件调用
  defineExpose({
    open,
  });
</script>
