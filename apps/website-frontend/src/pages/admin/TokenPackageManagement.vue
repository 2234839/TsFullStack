<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import type { SelectOption } from '@tsfullstack/shared-frontend/components';

const toast = useToast();
const { API } = useAPI();

/** 套餐项类型 */
interface TokenPackage {
  id: number;
  name: string;
  description: string | null;
  type: 'MONTHLY' | 'YEARLY' | 'PERMANENT';
  amount: number;
  price: number | null;
  durationMonths: number;
  active: boolean;
  sortOrder: number;
  created: string;
  updated: string;
}

/** 套餐列表 */
const packages = ref<TokenPackage[]>([]);

/** 加载中 */
const isLoading = ref(false);

/** 显示创建对话框 */
const showCreateDialog = ref(false);

/** 显示编辑对话框 */
const showEditDialog = ref(false);

/** 当前编辑的套餐 */
const editingPackage = ref<TokenPackage | null>(null);

/** 表单数据 */
const formData = ref({
  name: '',
  description: '',
  type: 'MONTHLY' as 'MONTHLY' | 'YEARLY' | 'PERMANENT',
  amount: 100,
  price: 0,
  durationMonths: 1,
  sortOrder: 0,
  active: true,
});

/** 提交中 */
const isSubmitting = ref(false);

/** 代币类型选项 */
const tokenTypeOptions: SelectOption[] = [
  { value: 'MONTHLY', label: '月度代币' },
  { value: 'YEARLY', label: '年度代币' },
  { value: 'PERMANENT', label: '永久代币' },
];

/** 过滤后的套餐列表 */
const filteredPackages = computed(() => {
  return packages.value.sort((a, b) => a.sortOrder - b.sortOrder);
});

/** 加载套餐列表 */
async function loadPackages() {
  isLoading.value = true;
  try {
    const result = await API.tokenPackageApi.listTokenPackages();
    packages.value = result as unknown as TokenPackage[];
  } catch (error) {
    console.error('[TokenPackageManagement] 加载失败:', error);
    toast.add({
      summary: '加载失败',
      detail: '加载套餐列表失败',
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

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
  showCreateDialog.value = true;
}

/** 打开编辑对话框 */
function openEditDialog(pkg: TokenPackage) {
  editingPackage.value = pkg;
  formData.value = {
    name: pkg.name,
    description: pkg.description || '',
    type: pkg.type,
    amount: pkg.amount,
    price: pkg.price || 0,
    durationMonths: pkg.durationMonths,
    sortOrder: pkg.sortOrder,
    active: pkg.active,
  };
  showEditDialog.value = true;
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

    toast.add({
      summary: '创建成功',
      detail: '套餐创建成功',
      variant: 'success',
    });

    showCreateDialog.value = false;
    await loadPackages();
  } catch (error) {
    console.error('[TokenPackageManagement] 创建失败:', error);
    const errorMessage = error instanceof Error ? error.message : '创建套餐失败';
    toast.add({
      summary: '创建失败',
      detail: errorMessage,
      variant: 'error',
    });
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

    toast.add({
      summary: '更新成功',
      detail: '套餐更新成功',
      variant: 'success',
    });

    showEditDialog.value = false;
    await loadPackages();
  } catch (error) {
    console.error('[TokenPackageManagement] 更新失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新套餐失败';
    toast.add({
      summary: '更新失败',
      detail: errorMessage,
      variant: 'error',
    });
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

    toast.add({
      summary: '操作成功',
      detail: pkg.active ? '套餐已停用' : '套餐已启用',
      variant: 'success',
    });

    await loadPackages();
  } catch (error) {
    console.error('[TokenPackageManagement] 切换状态失败:', error);
    toast.add({
      summary: '操作失败',
      detail: '切换套餐状态失败',
      variant: 'error',
    });
  }
}

/** 删除套餐 */
async function deletePackage(pkg: TokenPackage) {
  if (!confirm(`确定要删除套餐"${pkg.name}"吗？`)) {
    return;
  }

  try {
    await API.tokenPackageApi.deleteTokenPackage(pkg.id);

    toast.add({
      summary: '删除成功',
      detail: '套餐删除成功',
      variant: 'success',
    });

    await loadPackages();
  } catch (error) {
    console.error('[TokenPackageManagement] 删除失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除套餐失败';
    toast.add({
      summary: '删除失败',
      detail: errorMessage,
      variant: 'error',
    });
  }
}

/** 获取类型标签 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    MONTHLY: '月度代币',
    YEARLY: '年度代币',
    PERMANENT: '永久代币',
  };
  return labels[type] || type;
}

/** 格式化价格 */
function formatPrice(price: number | null): string {
  if (price === null) return '免费';
  return `¥${(price / 100).toFixed(2)}`;
}

onMounted(() => {
  loadPackages();
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          代币套餐管理
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          管理用户的代币套餐和订阅
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        @click="openCreateDialog"
      >
        创建套餐
      </button>
    </div>

    <!-- 套餐列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <!-- 加载中 -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredPackages.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无套餐</p>
      </div>

      <!-- 套餐卡片 -->
      <div v-else class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="pkg in filteredPackages"
            :key="pkg.id"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            :class="{ 'opacity-50': !pkg.active }"
          >
            <!-- 套餐头部 -->
            <div class="flex justify-between items-start mb-4">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ pkg.name }}
              </h3>
              <span
                class="px-2 py-1 text-xs rounded"
                :class="pkg.active ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'"
              >
                {{ pkg.active ? '已启用' : '已停用' }}
              </span>
            </div>

            <!-- 套餐信息 -->
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">类型:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {{ getTypeLabel(pkg.type) }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">代币数量:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ pkg.amount }} 枚</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">价格:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {{ formatPrice(pkg.price) }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">时长:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {{ pkg.durationMonths > 0 ? `${pkg.durationMonths} 个月` : '永久' }}
                </span>
              </div>
            </div>

            <!-- 描述 -->
            <p v-if="pkg.description" class="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {{ pkg.description }}
            </p>

            <!-- 操作按钮 -->
            <div class="mt-6 flex gap-2">
              <button
                type="button"
                class="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                @click="openEditDialog(pkg)"
              >
                编辑
              </button>
              <button
                type="button"
                class="px-3 py-2 text-sm bg-info-100 dark:bg-info-900 text-info-700 dark:text-info-300 rounded-lg hover:bg-info-200 dark:hover:bg-info-800 transition-colors"
                @click="togglePackageActive(pkg)"
              >
                {{ pkg.active ? '停用' : '启用' }}
              </button>
              <button
                type="button"
                class="px-3 py-2 text-sm bg-danger-100 dark:bg-danger-900 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800 transition-colors"
                @click="deletePackage(pkg)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建对话框 -->
    <Dialog
      v-model:open="showCreateDialog"
      title="创建套餐"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            套餐名称 *
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="例如：基础套餐"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            套餐描述
          </label>
          <textarea
            v-model="formData.description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="描述套餐的特点和适用人群"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              代币类型 *
            </label>
            <Select
              v-model="formData.type"
              :options="tokenTypeOptions"
              placeholder="请选择代币类型"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              代币数量 *
            </label>
            <input
              v-model.number="formData.amount"
              type="number"
              min="1"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              价格（分）
            </label>
            <input
              v-model.number="formData.price"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="0 表示免费"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              时长（月）
            </label>
            <input
              v-model.number="formData.durationMonths"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="0 表示永久"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            排序顺序
          </label>
          <input
            v-model.number="formData.sortOrder"
            type="number"
            min="0"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            @click="showCreateDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting || !formData.name"
            @click="createPackage"
          >
            {{ isSubmitting ? '创建中...' : '创建' }}
          </button>
        </div>
      </template>
    </Dialog>

    <!-- 编辑对话框 -->
    <Dialog
      v-model:open="showEditDialog"
      title="编辑套餐"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            套餐名称 *
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            套餐描述
          </label>
          <textarea
            v-model="formData.description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              代币类型 *
            </label>
            <Select
              v-model="formData.type"
              :options="tokenTypeOptions"
              placeholder="请选择代币类型"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              代币数量 *
            </label>
            <input
              v-model.number="formData.amount"
              type="number"
              min="1"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              价格（分）
            </label>
            <input
              v-model.number="formData.price"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              时长（月）
            </label>
            <input
              v-model.number="formData.durationMonths"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              排序顺序
            </label>
            <input
              v-model.number="formData.sortOrder"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div class="flex items-center">
            <label class="flex items-center cursor-pointer">
              <input
                v-model="formData.active"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">启用套餐</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            @click="showEditDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting || !formData.name"
            @click="updatePackage"
          >
            {{ isSubmitting ? '更新中...' : '更新' }}
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
