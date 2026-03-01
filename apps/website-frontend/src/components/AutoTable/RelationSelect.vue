<template>
  <RemoteSelect :modelValue="remoteSelectValue" @add="(el) => addItem(el)" @remove="(el) => removeItem(el)"
    :queryMethod="queryData" :showTag="false" :disabledItems="disabledItems" />
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

  // 获取反向字段名称（基于 ZenStack relation.opposite）
  const backLinkFieldName = getBackLinkFieldName(props.field);

  // 获取反向字段信息用于判断关系类型
  const backLinkField = backLinkFieldName
    ? (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]
    : undefined;
  const backLinkFieldData = backLinkField as unknown as Record<string, unknown> | undefined;

  console.log('[RelationSelect] 反向字段:', backLinkFieldName ? {
    name: backLinkFieldName,
    type: backLinkField?.type,
    isArray: backLinkFieldData?.array === true,
    isOptional: backLinkFieldData?.optional === true,
    display: `${relatedModelName} -> ${backLinkFieldName} -> ${(backLinkField as any).relation?.from}`,
  } : '无');
  console.log('[RelationSelect] 关系类型判断:', {
    关系类型: (() => {
      const isArrayCurrent = isArrayField(props.field);
      const isBackLinkArray = backLinkFieldData?.array === true;
      const isBackLinkOptional = backLinkFieldData?.optional === true;

      if (!isArrayCurrent && !isBackLinkArray) return '单对单关系 (One-to-One)';
      if (isArrayCurrent && !isBackLinkArray) {
        return isBackLinkOptional ? '一对多关系 (可选，One-to-Many Optional)' : '一对多关系 (必选，One-to-Many Required)';
      }
      if (!isArrayCurrent && isBackLinkArray) {
        return isBackLinkOptional ? '多对一关系 (可选，Many-to-One Optional)' : '多对一关系 (必选，Many-to-One Required)';
      }
      if (isArrayCurrent && isBackLinkArray) return '多对多关系 (Many-to-Many)';
      return '未知关系类型';
    })(),
    选择模式: (() => {
      const isArrayCurrent = isArrayField(props.field);
      const isBackLinkArray = backLinkFieldData?.array === true;
      const isBackLinkOptional = backLinkFieldData?.optional === true;

      if (!isArrayCurrent) return '单选切换';
      if (isBackLinkArray) return '多选';
      if (!isBackLinkArray) {
        return isBackLinkOptional ? '多选' : '单选切换';
      }
      return '未知';
    })(),
    能否取消已关联: (() => {
      const isBackLinkArray = backLinkFieldData?.array === true;
      const isBackLinkOptional = backLinkFieldData?.optional === true;
      return isBackLinkArray || isBackLinkOptional ? '可以' : '不能（必需关系）';
    })(),
  });
  console.log('[RelationSelect] 字段配置:', {
    refIdFieldName: refIdField.name,
    displayFieldName: displayField.name,
    displayFieldType: displayField.type,
    usingIdAsDisplay: displayField.name === refIdField.name,
  });

  const rowModelIdField = backLinkFieldName
    ? findIdField(modelMeta, (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]?.type as string || '')
    : undefined;
  //#endregion

  /**
   * 添加关联项
   *
   * ## 关系类型完整场景处理
   *
   * ### 1. 单对单关系（User.profile ↔ Profile.user）
   * - 当前字段：单个对象（非数组）
   * - 反向字段：单个对象（非数组）
   * - **行为**：单选切换模式
   * - **实现**：清空之前的选择，只保留新的
   * - **原因**：对于当前记录来说，只能关联一个对象
   *
   * ### 2. 单对多关系（User.userData）- 关联切换模式
   * - 当前字段：数组
   * - 反向字段：单个对象（非数组）
   * - **必选**（UserData.user 无 optional）：
   *   - **为什么是必选**：UserData.userId 是 NOT NULL 约束，每个 UserData 必须属于一个 User
   *   - **行为**：关联切换模式（可以多选，已选中的不能取消，但可以继续添加）
   *   - **实现**：直接添加到选择列表，由 removeItem 控制能否取消
   *   - **所有权转移**：选择已属于别人的记录时，会发生所有权转移（在 AutoTable.saveChanges 中处理）
   *   - **UI 表现**：已选中的项会显示为禁用状态（灰色），无法点击取消
   * - **可选**（理论上存在）：
   *   - 行为：多选模式，可以自由添加和移除
   *   - 实现：直接添加到选择列表
   *
   * ### 3. 多对一关系（Post.author）- 单选切换模式
   * - 当前字段：单个对象（非数组）
   * - 反向字段：数组（User.posts[]）
   * - **必选**（Post.author 无 optional）：
   *   - **为什么是必选**：Post.authorId 是 NOT NULL 约束，每篇文章必须有作者
   *   - **行为**：单选切换模式（只能选一个，选择新的会替换旧的，旧的会被取消关联）
   *   - **实现**：清空之前的选择，只保留新的
   *   - **原因**：对于当前记录来说，这相当于单对单的情况，只能有一个作者
   * - **可选**（author optional: true）：
   *   - **行为**：单选可选模式（可以选择一个，也可以取消选择）
   *   - **实现**：同样使用切换逻辑，但可以选择清空
   *
   * ### 4. 多对多关系（User.role）
   * - 当前字段：数组
   * - 反向字段：数组（Role.users[]）
   * - **行为**：多选模式，可以自由添加和移除
   * - **实现**：直接添加到选择列表
   * - **原因**：两边都是数组，没有 NOT NULL 约束问题
   *
   * ## 两种切换模式的区别
   *
   * ### 单选切换（多对一，如 Post.author）
   * - 只能选择一个
   * - 视觉上：单选框，只能勾选一个
   * - 行为：选择新的会替换旧的，旧的被取消
   * - **约束**：如果关联字段是必选的（author 无 optional），则不能为空，必须选择一个
   *
   * ### 关联切换（一对多必选，如 User.userData）
   * - 可以选择多个
   * - 视觉上：多选框，可以勾选多个
   * - 行为：
   *   - 已选中的不能取消（因为对方必选，NOT NULL 约束）
   *   - 但可以选择新的，新的会发生所有权转移
   *   - 例如：UserData 记录原本属于 UserA，现在选择 UserB，这条记录会转移到 UserB 名下
   * - **约束**：反向关联字段是必选的（UserData.user 无 optional），所以已选中的不能取消
   * - **UI 反馈**：已选中的项显示为禁用状态（灰色），标记为"必需"
   *
   * @param item 要添加的关联项
   */
  function addItem(item: RemoteSelectItem) {
    const isArrayRelation = isArrayField(props.field);
    const backLinkField = backLinkFieldName
      ? (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]
      : undefined;
    const isBackLinkArray = (backLinkField as unknown as Record<string, unknown>)?.array === true;

    if (!isArrayRelation) {
      // ========== 单对单/多对一关系 ==========
      // 单选模式（无论必选还是可选，都是切换逻辑）
      // 对于当前记录来说，多对一相当于单对单的情况
      // 将当前所有已选项移到 remove 列表（如果它们在 inculdes 中）
      for (const includedItem of modelValue.inculdes) {
        if (!RemoteSelectUtils.itemEquals(includedItem, item)) {
          RemoteSelectUtils.addItem(modelValue.remove, includedItem);
        }
      }
      modelValue.add = [item];
    } else {
      // ========== 数组关系（一对多或多对多）==========
      if (isBackLinkArray) {
        // 多对多关系：多选模式，可以自由添加和移除
        RemoteSelectUtils.removeItem(modelValue.remove, item);
        RemoteSelectUtils.addItem(modelValue.add, item);
      } else {
        // 一对多关系：多选模式
        // 反向字段是单个对象（如 UserData.user），无论是否可选都可以多选
        // 如果必选，已选中的不能取消（由 removeItem 控制）
        // 但可以继续添加更多的
        RemoteSelectUtils.removeItem(modelValue.remove, item);
        RemoteSelectUtils.addItem(modelValue.add, item);
      }
    }

    emit('change', modelValue);
  }

  /**
   * 移除关联项
   *
   * ## 取消行为的完整场景
   *
   * ### 决策树
   *
   * 1. 是否多对多关系？
   *    - 是（反向字段是数组）→ ✅ 可以取消
   *    - 否 → 继续判断
   *
   * 2. 反向关系是否可选？
   *    - 是（optional: true）→ ✅ 可以取消
   *    - 否（非 optional）→ 继续判断
   *
   * 3. 是否已关联的记录（在 includes 中）？
   *    - 是 → ❌ 不能取消（会违反 NOT NULL 约束）
   *    - 否 → ✅ 可以取消（只是从待添加列表移除）
   *
   * ### 具体场景
   *
   * | 关系类型 | 当前字段 | 反向字段 | 反向可选？ | 能否取消已关联 | 能否取消待添加 |
   * |---------|---------|---------|-----------|-------------|-------------|
   * | 单对单必选 | 单对象 | 单对象 | ❌         | ❌ 不能      | ✅ 可以      |
   * | 单对单可选 | 单对象 | 单对象 | ✅         | ✅ 可以      | ✅ 可以      |
   * | 一对多必选 | 数组   | 单对象 | ❌         | ❌ 不能      | ✅ 可以      |
   * | 一对多可选 | 数组   | 单对象 | ✅         | ✅ 可以      | ✅ 可以      |
   * | 多对一必选 | 单对象 | 数组   | ❌         | ❌ 不能      | ✅ 可以      |
   * | 多对一可选 | 单对象 | 数组   | ✅         | ✅ 可以      | ✅ 可以      |
   * | 多对多   | 数组   | 数组   | -         | ✅ 可以      | ✅ 可以      |
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
      isBackLinkArray: backLinkFieldName
        ? ((relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName] as unknown as Record<string, unknown>)?.array === true
        : false,
    });

    if (backLinkRequired) {
      // 如果反向关系是必需的，检查是否在 includes 列表中（即已关联的记录）
      const isIncluded = modelValue.inculdes.some((el) => RemoteSelectUtils.itemEquals(el, item));
      if (isIncluded) {
        // 禁止取消已关联的记录，因为这会导致外键约束违反
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
