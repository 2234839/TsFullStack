<template>
  <div>
    <RemoteSelect
      :modelValue="remoteSelectValue"
      @add="(el) => addItem(el)"
      @remove="(el) => removeItem(el)"
      :queryMethod="queryData"
      :showTag="false"
      :disabledItems="disabledItems" />
  </div>
</template>

<script lang="ts">
  import RemoteSelect, {
    RemoteSelectUtils,
    type RemoteSelectItem,
  } from '@/components/base/RemoteSelect.vue';
  export type RelationSelectData = {
    /** 新增和移除，用户手动点击 checked添加的 */
    add: RemoteSelectItem[];
    remove: RemoteSelectItem[];
    /** 之前就在的（在翻页中陆续添加进去） */
    inculdes: RemoteSelectItem[];
  };
</script>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import {
    injectModelMetaKey,
    type FieldInfo,
    type ModelMeta,
    isDataModelField,
    type ModelMetaNames,
    getBackLinkFieldName,
    getModelDbName,
    getModelAPI,
    isArrayField,
  } from '@/components/AutoTable/type';
  import { findDisplayField, findIdField } from '@/components/AutoTable/util';
  import { computed, inject, reactive } from 'vue';

  /**
   * 判断反向关系字段是否是必需的（不可为空）
   * 用于确定是否可以安全地 disconnect 关联
   *
   * ## 关系类型与取消行为的规则
   *
   * ### 1. 多对多关系（如 User.role）
   * - 当前字段：`User.role[]` (数组)
   * - 反向字段：`Role.users[]` (数组)
   * - **可以取消**：因为两边都是数组，取消关联不会导致任何约束违反
   * - 判断依据：反向字段的 `array === true`
   *
   * ### 2. 多对一关系（如 Post.author）
   * - 当前字段：`Post.author` (单个对象)
   * - 反向字段：`User.posts[]` (数组)
   * - **不能取消**：除非 `Post.author` 有 `optional: true`
   * - 原因：`Post` 必须有一个作者，取消会导致外键为 NULL
   * - 判断依据：反向字段的 `array === false` 且 `optional !== true`
   *
   * ### 3. 一对多关系（如 User.userData）
   * - 当前字段：`User.userData[]` (数组)
   * - 反向字段：`UserData.user` (单个对象)
   * - **不能取消**：因为 `UserData.userId` 是 NOT NULL 约束
   * - 原因：`UserData` 必须属于某个用户，不能没有所属用户
   * - 判断依据：反向字段的 `array === false` 且 `optional !== true`
   *
   * @param modelMeta 模型元数据
   * @param relatedModelName 被关联的模型名称（如 "UserData"）
   * @param backLinkFieldName 反向关系字段名称（如 "user"）
   * @returns 是否必需（true = 不能取消，false = 可以取消）
   */
  function isBackLinkRequired(modelMeta: ModelMeta, relatedModelName: string, backLinkFieldName: string): boolean {
    const relatedModel = Object.values(modelMeta.models).find(
      (model) => model.name === relatedModelName
    );
    if (!relatedModel || !backLinkFieldName) return false;

    const backLinkField = (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName];
    if (!backLinkField) return false;

    const fieldData = backLinkField as unknown as Record<string, unknown>;

    // 如果反向字段是数组（多对多关系），则不是必需的
    // 例如：User.role[] <-> Role.users[]，两边都是数组，可以自由取消关联
    if (fieldData.array === true) {
      return false;
    }

    // 如果反向字段是单个对象（多对一或一对多关系），检查 optional 属性
    // 例如：
    // - Post.author <-> User.posts[]，Post 必须有 author（除非 optional: true）
    // - User.userData[] <-> UserData.user，UserData 必须有 user（userId 是 NOT NULL）
    return fieldData.optional !== true;
  }

  const props = defineProps<{
    field: FieldInfo;
    row?: { [fieldName: string]: any };
  }>();

  /** item 都是 RelationData 的 item */
  const modelValue = reactive({
    add: [] as RemoteSelectItem[],
    remove: [] as RemoteSelectItem[],

    inculdes: [] as RemoteSelectItem[],
  });

  function mapRemoteSelectItem(el: any): RemoteSelectItem {
    return {
      value: el[refIdField.name],
      label: el[displayField.name] || el[refIdField.name],
    };
  }

  const remoteSelectValue = computed<RemoteSelectItem[]>(() => {
    const selectList = [...modelValue.add, ...modelValue.inculdes];
    const list = selectList.filter(
      (el) =>
        /** 过滤存在于 remove 列表中的元素 */
        !modelValue.remove.some((removeItem) => RemoteSelectUtils.itemEquals(el, removeItem)),
    );
    return list;
  });

  /**
   * 计算不可取消的项列表（已关联且反向关系是必需的）
   *
   * ## 为什么需要禁用某些项？
   *
   * ### 多对多关系（User.role）
   * - `backLinkRequired = false`
   * - 返回空数组，所有项都可以取消
   *
   * ### 一对多关系（User.userData）
   * - `backLinkRequired = true`
   * - 返回 `modelValue.inculdes` 中所有已关联的项
   * - 这些项在 UI 上会被禁用（灰色显示，无法点击）
   * - 原因：取消会导致 `UserData.userId` 为 NULL，违反数据库约束
   *
   * ## 过滤逻辑
   * - 排除那些已经在 `remove` 列表中的项（虽然逻辑上不应该存在）
   * - 只返回真正需要禁用的项
   */
  const disabledItems = computed<RemoteSelectItem[]>(() => {
    const backLinkRequired = isBackLinkRequired(
      modelMeta,
      relatedModelName,
      backLinkFieldName || ''
    );

    // 如果反向关系不是必需的，所有项都可以取消
    if (!backLinkRequired) return [];

    // 返回已关联且不能取消的项
    return modelValue.inculdes.filter((item) => {
      // 排除那些已经在 remove 列表中的（虽然逻辑上不应该存在）
      return !modelValue.remove.some((removeItem) => RemoteSelectUtils.itemEquals(removeItem, item));
    });
  });

  const modelMeta = inject(injectModelMetaKey)!;
  const emit = defineEmits<{
    (e: 'change', value: any): void;
  }>();

  //#region 列相关数据
  const relatedModelName = props.field.type as string;
  const relatedModel = Object.values(modelMeta.models).find(
    (model) => model.name === relatedModelName,
  )!;
  const relatedModelKey = Object.keys(modelMeta.models).find(
    (key) => (modelMeta?.models as any)[key]?.name === relatedModelName,
  ) as ModelMetaNames;

  const refIdField = findIdField(modelMeta, relatedModelName)!;
  const displayField = findDisplayField(modelMeta, relatedModelKey) || refIdField;

  console.log('[RelationSelect] Field selection:', {
    relatedModelName,
    relatedModelKey,
    refIdFieldName: refIdField.name,
    displayFieldName: displayField.name,
    displayFieldType: displayField.type,
    usingIdAsDisplay: displayField.name === refIdField.name,
  });

  // 获取反向字段名称（基于 ZenStack relation.opposite）
  const backLinkFieldName = getBackLinkFieldName(props.field);
  const rowModelIdField = backLinkFieldName
    ? findIdField(modelMeta, (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]?.type as string || '')
    : undefined;
  //#endregion

  /**
   * 添加关联项
   *
   * ## 一对多 vs 多对多的区别处理
   *
   * ### 多对多关系（User.role）
   * - **多选模式**：可以同时选择多个角色
   * - 例如：用户可以同时是 "admin" 和 "editor"
   * - 行为：直接添加到选择列表
   *
   * ### 一对多关系（User.userData）
   * - **单选切换模式**：只能选择一个，选择新的会替换旧的
   * - 原因：一个 `UserData` 只能属于一个用户，但一个用户可以有多个 `UserData`
   * - 行为：选择新的 `UserData` 时，自动转移所有权（从其他用户转移到当前用户）
   * - 实现：清空之前的所有选择，只保留新的选择
   *
   * @param item 要添加的关联项
   */
  function addItem(item: RemoteSelectItem) {
    // 检查当前字段是否是数组关系
    const isArrayRelation = isArrayField(props.field);

    if (!isArrayRelation) {
      // 多对一关系（单选）：清空之前的选择，只保留新的
      // 这实际上是单选模式，但用多选组件实现
      modelValue.add = [item];
      modelValue.remove = [];
    } else {
      // 检查反向关系是否是数组（判断是多对多还是一对多）
      const backLinkField = backLinkFieldName
        ? (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]
        : undefined;
      const isBackLinkArray = (backLinkField as unknown as Record<string, unknown>)?.array === true;

      if (isBackLinkArray) {
        // 多对多关系（多选）：可以同时选择多个
        RemoteSelectUtils.removeItem(modelValue.remove, item);
        RemoteSelectUtils.addItem(modelValue.add, item);
      } else {
        // 一对多关系（单选切换）：选择新的会替换旧的
        // 清空之前的所有选择
        modelValue.add = [item];
        modelValue.remove = [];
      }
    }

    emit('change', modelValue);
  }

  /**
   * 移除关联项
   *
   * ## 为什么需要检查反向关系是否必需？
   *
   * ### 场景 1：多对多关系（User.role）
   * - 可以自由取消，不会违反任何约束
   * - `backLinkRequired = false`
   *
   * ### 场景 2：一对多关系（User.userData）
   * - **不能取消已存在的关联**，因为：
   *   1. `UserData.userId` 有 NOT NULL 约束
   *   2. 取消关联会导致 `userId` 为 NULL，违反数据库约束
   *   3. 错误：`NOT NULL constraint failed: UserData.userId`
   * - `backLinkRequired = true`
   *
   * ### 场景 3：用户刚添加但未保存的项
   * - **可以取消**，因为：
   *   1. 这些项在 `modelValue.add` 中
   *   2. 还未保存到数据库
   *   3. 取消只是从待添加列表中移除，不会影响数据库
   *
   * @param item 要移除的关联项
   */
  function removeItem(item: RemoteSelectItem) {
    // 检查反向关系是否是必需的（不能为空）
    const backLinkRequired = isBackLinkRequired(
      modelMeta,
      relatedModelName,
      backLinkFieldName || ''
    );

    console.log('[RelationSelect] removeItem:', {
      item,
      backLinkFieldName,
      backLinkRequired,
      relationType: isArrayField(props.field) ? 'array' : 'single',
    });

    if (backLinkRequired) {
      // 如果反向关系是必需的，检查是否在 includes 列表中（即已关联的记录）
      const isIncluded = modelValue.inculdes.some((el) => RemoteSelectUtils.itemEquals(el, item));
      if (isIncluded) {
        // 禁止取消已关联的记录，因为这会导致外键约束违反
        // 例如：UserData.userId 是 NOT NULL，不能取消关联
        console.warn('[RelationSelect] Cannot disconnect required relation:', item);
        return;
      }
    }

    // 允许取消尚未保存到数据库的添加操作
    // 这些项在 modelValue.add 中，还未保存，可以安全移除
    RemoteSelectUtils.removeItem(modelValue.add, item);
    RemoteSelectUtils.addItem(modelValue.remove, item);
    emit('change', modelValue);
  }

  const { API } = useAPI();
  async function loadRelationData(
    modelMeta: ModelMeta,
    field: FieldInfo,
    skip = 0,
    take = 10,
    search = '',
  ) {
    const initObj = {
      list: [],
      count: 0,
    };
    if (!isDataModelField(field) || !modelMeta) return initObj;

    const where = search
      ? {
          [displayField.name]: {
            contains: search,
          },
        }
      : {};

    const modelIdValue = rowModelIdField ? props.row?.[rowModelIdField.name] : undefined;
    // 类型安全的模型访问
    const relatedDbName = getModelDbName(relatedModelKey);
    const relatedAPI = getModelAPI(API, relatedDbName);
    const [list, count] = await Promise.all([
      relatedAPI.findMany({
        where,
        select: {
          [refIdField.name]: true,
          [displayField.name]: true,
          /** 需要查询出反向关系的数据，用于判断是否被引用了  */
          ...(backLinkFieldName && rowModelIdField && {
            [backLinkFieldName]: {
              select: {
                [rowModelIdField.name]: true,
              },
            },
          }),
        },
        skip,
        take,
      } as any),
      relatedAPI.count({ where } as any ),
    ]);
    console.log('[list, count]',list, count);
    list.forEach((el: any) => {
      // 检查反向关系是否匹配当前行
      let relationMatch = false;

      if (backLinkFieldName && rowModelIdField && modelIdValue) {
        const backLinkValue = el[backLinkFieldName];
        const idFieldName = rowModelIdField.name;

        if (Array.isArray(backLinkValue)) {
          // 反向关系是数组（如 User.posts）
          relationMatch = backLinkValue.some((item: any) => item[idFieldName] === modelIdValue);
        } else if (backLinkValue && typeof backLinkValue === 'object') {
          // 反向关系是单个对象（如 Post.author）
          relationMatch = backLinkValue[idFieldName] === modelIdValue;
        }
      }

      if (!relationMatch) return;

      // 应该先判断是否存在与 add 或remove 中，存在则跳过
      const selectItem = mapRemoteSelectItem(el);
      if (modelValue.add.some((item) => RemoteSelectUtils.itemEquals(item, selectItem))) return;
      if (modelValue.remove.some((item) => RemoteSelectUtils.itemEquals(item, selectItem))) return;
      if (modelValue.inculdes.some((item) => RemoteSelectUtils.itemEquals(item, selectItem)))
        return;
      modelValue.inculdes.push(selectItem);
    });

    return {
      list: list.map((record: any) => ({
        label: String(record[displayField.name]),
        value: record[refIdField.name],
      })),
      count,
    };
  }

  const queryData = async (param: { keyword: string; skip: number; take: number }) => {
    const { count, list } = await loadRelationData(
      modelMeta,
      props.field,
      param.skip,
      param.take,
      param.keyword,
    );
    return {
      data: list,
      total: count,
    };
  };
</script>
