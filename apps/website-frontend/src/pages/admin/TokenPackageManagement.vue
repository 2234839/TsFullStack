<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { usePaginatedQuery } from '@/composables/usePaginatedQuery';
import { useAPI } from '@/api';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import { TokenOptions, type TokenType } from '@tsfullstack/backend';
import { getTypeLabel } from '@/utils/admin';
import { getErrorMessage } from '@/utils/error';
import { formatPriceWithCurrency } from '@/utils/format';
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { API } = useAPI();

/** 套餐项类型（手动定义，避免 DbListItem 对含 Json 字段模型的 TS2589） */
interface TokenPackage {
  id: number;
  created: Date;
  updated: Date;
  name: string;
  description: string | null;
  type: TokenType;
  amount: number;
  price: number | null;
  durationMonths: number;
  active: boolean;
  sortOrder: number;
  restrictedType: unknown;
}

const {
  items: packages,
  total: packagesTotal,
  currentPage: packagesPage,
  pageSize: packagesPageSize,
  isLoading,
  load: loadPackages,
  goToPage,
  updatePageSize,
} = usePaginatedQuery<TokenPackage>({
  pageSize: 9,
  errorMessage: '加载套餐列表失败',
  fetchFn: async ({ skip, take }) => {
    const [data, total] = await Promise.all([
      API.db.tokenPackage.findMany({
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
      }),
      API.db.tokenPackage.count(),
    ]);
    return { data, total };
  },
});

/** 对话框模式 */
type DialogMode = 'create' | 'edit' | null;
const dialogMode = ref<DialogMode>(null);
const showDialog = computed({
  get: () => dialogMode.value !== null,
  set: (v: boolean) => { if (!v) dialogMode.value = null; },
});

/** 当前编辑的套餐 */
const editingPackage = ref<TokenPackage | null>(null);

/** 表单数据 */
const formData = ref({
  name: '',
  description: '',
  type: 'MONTHLY' as TokenType,
  amount: 100,
  price: 0,
  durationMonths: 1,
  sortOrder: 0,
  active: true,
});

/** 提交中 */
const isSubmitting = ref(false);

/** 代币类型选项（从后端导入） */
const tokenTypeOptions = TokenOptions.TokenTypeOptions;

/** 打开创建对话框 */
function openCreateDialog() {
  formData.value = {
    name: '',
    description: '',
    type: 'MONTHLY',
    amount: 100,
    price: 0,
    durationMonths: 1,
    sortOrder: 0,
    active: true,
  };
  dialogMode.value = 'create';
}

/** 打开编辑对话框 */
function openEditDialog(pkg: TokenPackage) {
  editingPackage.value = pkg;
  formData.value = {
    name: pkg.name,
    description: pkg.description || '',
    type: pkg.type,
    amount: pkg.amount,
    price: pkg.price ?? 0,
    durationMonths: pkg.durationMonths,
    sortOrder: pkg.sortOrder,
    active: pkg.active,
  };
  dialogMode.value = 'edit';
}

/** 创建套餐 */
async function createPackage() {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await API.tokenPackageApi.createTokenPackage({
      name: formData.value.name,
      description: formData.value.description || undefined,
      type: formData.value.type,
      amount: formData.value.amount,
      price: formData.value.price || undefined,
      durationMonths: formData.value.durationMonths,
      sortOrder: formData.value.sortOrder,
    });

    toast.success(t('创建成功'), t('套餐创建成功'));

    dialogMode.value = null;
    await loadPackages();
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, t('创建套餐失败'));
    toast.error(t('创建失败'), errorMessage);
  } finally {
    isSubmitting.value = false;
  }
}

/** 更新套餐 */
async function updatePackage() {
  if (isSubmitting.value || !editingPackage.value) return;

  isSubmitting.value = true;
  try {
    await API.tokenPackageApi.updateTokenPackage(editingPackage.value.id, {
      name: formData.value.name,
      description: formData.value.description || undefined,
      amount: formData.value.amount,
      price: formData.value.price || undefined,
      durationMonths: formData.value.durationMonths,
      sortOrder: formData.value.sortOrder,
      active: formData.value.active,
    });

    toast.success(t('更新成功'), t('套餐更新成功'));

    dialogMode.value = null;
    await loadPackages();
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, t('更新套餐失败'));
    toast.error(t('更新失败'), errorMessage);
  } finally {
    isSubmitting.value = false;
  }
}

/** 切换套餐状态 */
async function togglePackageActive(pkg: TokenPackage) {
  try {
    await API.tokenPackageApi.updateTokenPackage(pkg.id, {
      active: !pkg.active,
    });

    toast.success(t('操作成功'), pkg.active ? t('套餐已停用') : t('套餐已启用'));

    await loadPackages();
  } catch (error: unknown) {
    toast.error(t('操作失败'), t('切换套餐状态失败'));
  }
}

/** 删除套餐 */
async function deletePackage(pkg: TokenPackage) {
  const accepted = await confirm.require({
    message: `${t('确定要删除套餐')}"${pkg.name}"${t('吗？')}`,
    acceptProps: { variant: 'danger' },
  });
  if (!accepted) return;

  try {
    await API.tokenPackageApi.deleteTokenPackage(pkg.id);

    toast.success(t('删除成功'), t('套餐删除成功'));

    await loadPackages();
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, t('删除套餐失败'));
    toast.error(t('删除失败'), errorMessage);
  }
}

/** 获取类型标签 — 从 utils/admin.ts 统一导入 */

onMounted(loadPackages);
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8 flex justify-between items-center">
      <PageHeader size="large" no-margin :subtitle="t('管理用户的代币套餐和订阅')">
        {{ t('代币套餐管理') }}
      </PageHeader>
      <Button @click="openCreateDialog">
        {{ t('创建套餐') }}
      </Button>
    </div>

    <!-- 套餐列表 -->
    <div class="bg-white dark:bg-primary-800 rounded-lg shadow">
      <!-- 加载中 -->
      <div v-if="isLoading" class="text-center py-12">
        <ProgressSpinner />
        <p class="mt-2 text-primary-600 dark:text-primary-400">{{ t('加载中...') }}</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="packages.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p class="mt-2 text-primary-600 dark:text-primary-400">{{ t('暂无套餐') }}</p>
      </div>

      <!-- 套餐卡片 -->
      <div v-else class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="pkg in packages"
            :key="pkg.id"
            class="border border-primary-200 dark:border-primary-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            :class="{ 'opacity-50': !pkg.active }"
          >
            <!-- 套餐头部 -->
            <div class="flex justify-between items-start mb-4">
              <h3 class="text-xl font-semibold text-primary-900 dark:text-primary-100">
                {{ pkg.name }}
              </h3>
              <span
                class="px-2 py-1 text-xs rounded"
                :class="pkg.active ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200' : 'bg-primary-100 text-primary-800 dark:bg-primary-700 dark:text-primary-300'"
              >
                {{ pkg.active ? t('已启用') : t('已停用') }}
              </span>
            </div>

            <!-- 套餐信息 -->
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-primary-600 dark:text-primary-400">{{ t('类型:') }}</span>
                <span class="font-medium text-primary-900 dark:text-primary-100">
                  {{ getTypeLabel(pkg.type) }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-primary-600 dark:text-primary-400">{{ t('代币数量:') }}</span>
                <span class="font-medium text-primary-900 dark:text-primary-100">{{ pkg.amount }} {{ t('枚') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-primary-600 dark:text-primary-400">{{ t('价格:') }}</span>
                <span class="font-medium text-primary-900 dark:text-primary-100">
                  {{ pkg.price === null ? t('免费') : formatPriceWithCurrency(pkg.price) }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-primary-600 dark:text-primary-400">{{ t('时长:') }}</span>
                <span class="font-medium text-primary-900 dark:text-primary-100">
                  {{ pkg.durationMonths > 0 ? `${pkg.durationMonths} ${t('个月')}` : t('永久') }}
                </span>
              </div>
            </div>

            <!-- 描述 -->
            <p v-if="pkg.description" class="mt-4 text-sm text-primary-600 dark:text-primary-400">
              {{ pkg.description }}
            </p>

            <!-- 操作按钮 -->
            <div class="mt-6 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                class="flex-1"
                @click="openEditDialog(pkg)"
              >
                {{ t('编辑') }}
              </Button>
              <Button
                :variant="pkg.active ? 'secondary' : 'ghost'"
                size="sm"
                @click="togglePackageActive(pkg)"
              >
                {{ pkg.active ? t('停用') : t('启用') }}
              </Button>
              <Button
                variant="danger"
                size="sm"
                @click="deletePackage(pkg)"
              >
                {{ t('删除') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="packagesTotal > 0" class="mt-6 pt-4 border-t border-primary-200 dark:border-primary-700">
          <Paginator
            :rows="packagesTotal"
            :rows-per-page="packagesPageSize"
            :page="packagesPage"
            :show-rows-per-page-options="true"
            @update:page="goToPage"
            @update:rows-per-page="updatePageSize"
          />
        </div>
      </div>
    </div>

    <!-- 创建/编辑对话框（统一模板，通过 dialogMode 区分） -->
    <Dialog
      v-model:open="showDialog"
      :title="dialogMode === 'create' ? t('创建套餐') : t('编辑套餐')"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            {{ t('套餐名称 *') }}
          </label>
          <Input
            v-model="formData.name"
            :placeholder="dialogMode === 'create' ? t('例如：基础套餐') : undefined"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            {{ t('套餐描述') }}
          </label>
          <Textarea
            v-model="formData.description"
            :rows="3"
            :placeholder="dialogMode === 'create' ? t('描述套餐的特点和适用人群') : undefined"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              {{ t('代币类型 *') }}
            </label>
            <Select
              v-model="formData.type"
              :options="tokenTypeOptions"
              :placeholder="t('请选择代币类型')"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              {{ t('代币数量 *') }}
            </label>
            <InputNumber
              v-model="formData.amount"
              :min="1"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              {{ t('价格（分）') }}
            </label>
            <InputNumber
              v-model="formData.price"
              :min="0"
              :placeholder="dialogMode === 'create' ? t('0 表示免费') : undefined"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              {{ t('时长（月）') }}
            </label>
            <InputNumber
              v-model="formData.durationMonths"
              :min="0"
              :placeholder="dialogMode === 'create' ? t('0 表示永久') : undefined"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              {{ t('排序顺序') }}
            </label>
            <InputNumber
              v-model="formData.sortOrder"
              :min="0"
            />
          </div>

          <div v-if="dialogMode === 'edit'" class="flex items-center">
            <Checkbox v-model="formData.active" :label="t('启用套餐')" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            @click="dialogMode = null"
          >
            {{ t('取消') }}
          </Button>
          <Button
            :disabled="isSubmitting || !formData.name"
            :loading="isSubmitting"
            @click="dialogMode === 'create' ? createPackage() : updatePackage()"
          >
            {{ isSubmitting ? (dialogMode === 'create' ? t('创建中...') : t('更新中...')) : (dialogMode === 'create' ? t('创建') : t('更新')) }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
