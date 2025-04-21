<template>
  <Dialog
    v-model:visible="visible"
    :header="t('新增记录')"
    :style="{ width: '50vw' }"
    :modal="true"
    :closable="true"
    :draggable="false"
    @hide="resetForm">
    <div class="p-fluid">
      <div>
        <div v-for="field in formFields" :key="field.name" class="field col-12 md:col-6 mb-4">
          <label :for="'field-' + field.name" class="block text-sm font-medium mb-1">
            {{ field.name }}
            <span v-if="isRequiredField(field)" class="text-red-500">*</span>
            <span class="text-xs text-gray-500 ml-1">({{ field.type }})</span>
          </label>

          <!-- 使用AutoColumn组件进行值编辑 -->
          <div v-if="!field.isDataModel">
            <AutoColumnEdit :field="field" :cellData="undefined" v-model="formData[field.name]" />
            <small v-if="fieldErrors[field.name]" class="p-error block mt-1">{{
              fieldErrors[field.name]
            }}</small>
            <small v-else-if="field.documentation" class="text-gray-500 block mt-1">{{
              field.documentation
            }}</small>
          </div>

          <!-- 关系字段 -->
          <div v-else class="flex flex-column">
            <Select
              :id="'field-' + field.name"
              v-model="formData[field.name]"
              :options="relationOptions[field.name] || []"
              optionLabel="label"
              optionValue="value"
              :class="{ 'p-invalid': fieldErrors[field.name] }"
              :placeholder="t('请选择关联记录')"
              :disabled="!relationOptions[field.name]"
              :loading="loadingRelations[field.name]" />
            <small v-if="fieldErrors[field.name]" class="p-error block mt-1">{{
              fieldErrors[field.name]
            }}</small>
            <small v-else-if="loadingRelations[field.name]" class="text-gray-500 block mt-1">{{
              t('加载中...')
            }}</small>
            <small v-else-if="!relationOptions[field.name]" class="text-gray-500 block mt-1">{{
              t('无可用关联记录')
            }}</small>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        :label="t('取消')"
        icon="pi pi-times"
        @click="visible = false"
        class="p-button-text" />
      <Button :label="t('保存')" icon="pi pi-check" @click="saveRecord" :loading="saving" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { Dialog, Button, Dropdown, useToast, Select } from 'primevue';
  import { useI18n } from 'vue-i18n';
  import { useAPI } from '@/api';
  import AutoColumn from './AutoColumn.vue';
  import type { FieldInfo, ModelMeta } from './type';
  import { findIdField } from '@/components/AutoTable/util';
  import AutoColumnEdit from '@/components/AutoTable/AutoColumnEdit.vue';

  const { t } = useI18n();
  const toast = useToast();
  const { API } = useAPI();

  const props = defineProps({
    modelName: {
      type: String,
      required: true,
    },
    modelKey: {
      type: String,
      required: true,
    },
    modelFields: {
      type: Object,
      required: true,
    },
    modelMeta: {
      type: Object as () => ModelMeta,
      required: true,
    },
  });

  const emit = defineEmits(['created', 'update:visible']);

  // 表单状态
  const visible = ref(false);
  const saving = ref(false);
  const formData = ref<Record<string, any>>({});
  const fieldErrors = ref<Record<string, string>>({});

  // 关系数据
  const relationOptions = ref<Record<string, Array<{ label: string; value: any }>>>({});
  const loadingRelations = ref<Record<string, boolean>>({});

  // 计算属性：表单字段
  const formFields = computed(() => {
    return Object.values(props.modelFields).filter((field: FieldInfo) => {
      // 排除自动生成的ID字段和不可编辑的字段
      return !(field.isId && field.isAutoIncrement);
    });
  });

  // 判断字段是否必填
  function isRequiredField(field: FieldInfo) {
    return !field.isOptional && !field.defaultValueProvider && !field.isId;
  }

  // 加载关系数据
  async function loadRelationData(field: FieldInfo) {
    if (!field.isDataModel) return;

    const relatedModelName = field.type;
    const relatedModelKey = Object.keys(props.modelMeta.models).find(
      (key) => props.modelMeta.models[key].name === relatedModelName,
    );

    if (!relatedModelKey) return;

    // 查找关联模型的ID字段
    const idField = findIdField(props.modelMeta, relatedModelName);
    if (!idField) return;

    // 查找一个可以用作显示标签的字段（优先选择String类型）
    const displayField =
      Object.values(props.modelMeta.models[relatedModelKey].fields).find(
        (f: FieldInfo) => f.type === 'String' && !f.isId,
      ) || idField;

    loadingRelations.value[field.name] = true;

    try {
      // @ts-ignore
      const records = await API.db[relatedModelKey].findMany({
        select: {
          [idField.name]: true,
          [displayField.name]: true,
        },
        take: 100, // 限制加载数量
      });

      relationOptions.value[field.name] = records.map((record: any) => ({
        label: String(record[displayField.name]),
        value: record[idField.name],
      }));
    } catch (error) {
      console.error(`Failed to load relation data for ${field.name}:`, error);
    } finally {
      loadingRelations.value[field.name] = false;
    }
  }

  // 重置表单
  function resetForm() {
    formData.value = {};
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
        (formData.value[field.name] === undefined ||
          formData.value[field.name] === null ||
          formData.value[field.name] === '')
      ) {
        fieldErrors.value[field.name] = t('此字段为必填项');
        isValid = false;
      }
    });

    return isValid;
  }

  // 保存记录
  async function saveRecord() {
    if (!validateForm()) return;

    saving.value = true;

    try {
      // 准备数据，处理关系字段
      const data: Record<string, any> = {};

      for (const field of formFields.value) {
        const fieldName = field.name;
        const value = formData.value[fieldName];

        // 跳过未设置的可选字段
        if (field.isOptional && (value === undefined || value === null || value === '')) {
          continue;
        }

        // 处理关系字段
        if (field.isDataModel) {
          if (value) {
            const idField = findIdField(props.modelMeta, field.type);
            if (idField) {
              data[fieldName] = { connect: { [idField.name]: value } };
            }
          }
        } else {
          data[fieldName] = value;
        }
      }

      // 创建记录
      // @ts-ignore
      const result = await API.db[props.modelKey].create({
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

      // 当对话框打开时，加载关系数据
      if (newValue) {
        // formFields.value.forEach((field: FieldInfo) => {
        //   if (field.isDataModel) {
        //     loadRelationData(field);
        //   }
        // });
      }
    },
  );

  // 打开对话框
  function open() {
    resetForm();
    visible.value = true;

    // 在每次打开对话框时加载关系数据
    formFields.value.forEach((field: FieldInfo) => {
      if (field.isDataModel) {
        loadRelationData(field);
      }
    });
  }

  onMounted(() => {
    // 在组件挂载后立即执行一次，确保关系数据加载的初始化
    // formFields.value.forEach((field: FieldInfo) => {
    //   if (field.isDataModel) {
    //     loadRelationData(field);
    //   }
    // });
  });

  // 导出方法供父组件调用
  defineExpose({
    open,
  });
</script>
