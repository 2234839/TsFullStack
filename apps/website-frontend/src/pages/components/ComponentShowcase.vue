<!-- ABOUTME: 组件展示页（showcase）— 集中展示与验证所有 UI 组件的渲染效果与交互 -->
<script setup lang="ts">
import { ref } from "vue";
import {
  Dialog,
  Drawer,
  Dropdown,
  Popover,
  ContextMenu,
  ScrollArea,
  Select,
  Tooltip,
} from "@tsfullstack/shared-frontend/components";
import { useConfirm } from "@/composables/useConfirm";
import Toast from "@/components/system/Toast.vue";
import { useToast } from "@/composables/useToast";

// ---------- base 组件演示状态 ----------
const confirmService = useConfirm();
const text = ref("");
const textarea = ref("");
const password = ref("");
const number = ref(0);
const checked = ref(false);
const switched = ref(false);
const slider = ref(50);
const selectValue = ref<string | undefined>();
const multiValue = ref<string[]>([]);
const selectButton = ref("A");
const selectButtonMulti = ref<string[]>([]);
const toastService = useToast();
const date = ref<Date | undefined>();
const progress = ref(66);
const tagOpen = ref(true);

const selectOptions = [
  { label: "选项一", value: "1" },
  { label: "选项二", value: "2" },
  { label: "选项三", value: "3" },
];

const tableColumns = [
  { key: "id", title: "ID", width: 60 },
  { key: "name", title: "姓名", sortable: true },
  { key: "role", title: "角色" },
  { key: "status", title: "状态" },
];

const tableData = [
  { id: 1, name: "张三", role: "管理员", status: "启用" },
  { id: 2, name: "李四", role: "编辑", status: "禁用" },
  { id: 3, name: "王五", role: "访客", status: "启用" },
];

// ---------- 浮层组件演示状态 ----------
const dialogOpen = ref(false);
const drawerOpen = ref(false);
const dropdownOpen = ref(false);
const popoverOpen = ref(false);
/** ContextMenu 组件引用 */
const contextMenuRef = ref<InstanceType<typeof ContextMenu>>();
/** 右键菜单项 */
const contextMenuItems = [
  { label: "复制", icon: "pi pi-copy", command: () => {} },
  { label: "粘贴", icon: "pi pi-clipboard", command: () => {} },
  { label: "删除", icon: "pi pi-trash", command: () => {} },
];

const messages = [
  { severity: "info", text: "这是一条信息提示" },
  { severity: "success", text: "操作成功完成" },
  { severity: "warn", text: "请注意潜在风险" },
  { severity: "error", text: "操作失败，请重试" },
] as const;
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold text-primary-title">组件展示</h1>
      <p class="mt-1 text-primary-subtle">集中展示所有 UI 组件，用于视觉审计与回归验证。</p>
    </header>

    <!-- ==================== Button ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">Button</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button label="主要" variant="primary" />
        <Button label="次要" variant="secondary" />
        <Button label="文本" variant="text" />
        <Button label="危险" variant="danger" />
        <Button label="幽灵" variant="ghost" />
        <Button label="文字按钮" variant="text-button" />
        <Button icon="pi pi-check" label="带图标" variant="primary" />
        <Button icon="pi pi-cog" variant="text" />
        <Button label="小尺寸" size="small" variant="primary" />
        <Button label="大尺寸" size="large" variant="primary" />
        <Button label="禁用" disabled variant="primary" />
        <Button label="加载中" loading variant="primary" />
      </div>
    </section>

    <!-- ==================== Input 系列 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">输入类</h2>
      <div class="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label class="text-primary-label mb-1 block text-sm">Input</label>
          <Input v-model="text" placeholder="请输入内容" />
        </div>
        <div>
          <label class="text-primary-label mb-1 block text-sm">Password</label>
          <Password v-model="password" placeholder="请输入密码" :feedback="false" />
        </div>
        <div>
          <label class="text-primary-label mb-1 block text-sm">InputNumber</label>
          <InputNumber v-model="number" />
        </div>
        <div>
          <label class="text-primary-label mb-1 block text-sm">DatePicker</label>
          <DatePicker v-model="date" />
        </div>
        <div class="sm:col-span-2">
          <label class="text-primary-label mb-1 block text-sm">Textarea</label>
          <Textarea v-model="textarea" :rows="3" placeholder="多行输入" />
        </div>
        <div class="sm:col-span-2">
          <label class="text-primary-label mb-1 block text-sm">InputGroup</label>
          <InputGroup>
            <InputGroupAddon>https://</InputGroupAddon>
            <Input placeholder="example.com" />
            <InputGroupAddon>.com</InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </section>

    <!-- ==================== 选择类 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">选择类</h2>
      <div class="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label class="text-primary-label mb-1 block text-sm">Select</label>
          <Select v-model="selectValue" :options="selectOptions" placeholder="请选择" />
        </div>
        <div>
          <label class="text-primary-label mb-1 block text-sm">MultiSelect</label>
          <MultiSelect v-model="multiValue" :options="selectOptions" placeholder="多选" />
        </div>
        <div class="flex items-center gap-6">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="checked" binary />
            Checkbox
          </label>
          <label class="flex items-center gap-2 text-sm">
            <ToggleSwitch v-model="switched" />
            ToggleSwitch
          </label>
        </div>
        <div>
          <label class="text-primary-label mb-1 block text-sm">SelectButton</label>
          <SelectButton v-model="selectButton" :options="['A', 'B', 'C']" />
          <SelectButton
            v-model="selectButtonMulti"
            :options="['X', 'Y', 'Z']"
            multiple
            class="mt-2"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="text-primary-label mb-1 block text-sm">Slider（{{ slider }}）</label>
          <Slider v-model="slider" />
        </div>
      </div>
    </section>

    <!-- ==================== 展示类 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">展示类</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <Tag value="标签" />
          <Tag value="主要" variant="contrast" />
          <Tag value="成功" variant="success" />
          <Tag value="警告" variant="warn" />
          <Tag value="危险" variant="danger" />
          <Tag value="信息" variant="info" />
          <Badge value="9" />
          <Badge value="NEW" severity="success" />
          <Avatar label="Z" shape="circle" />
          <Avatar icon="pi pi-user" shape="circle" />
          <UserAvatar :fileId="null" size="sm" />
          <UserAvatar :fileId="null" size="md" />
          <UserAvatar :fileId="null" size="lg" />
        </div>
        <div class="flex items-center gap-6">
          <ProgressBar :value="progress" class="w-64" />
          <ProgressSpinner class="h-10 w-10" />
        </div>
        <Tooltip content="提示内容">
          <Button label="悬停查看 Tooltip" variant="secondary" />
        </Tooltip>
        <Message variant="info">这是一条信息提示</Message>
        <Message variant="success">操作成功完成</Message>
        <Message variant="warn">请注意潜在风险</Message>
        <Message variant="error">操作失败，请重试</Message>
      </div>
    </section>

    <!-- ==================== 数据类 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">数据类</h2>
      <DataTable :data="tableData" :columns="tableColumns" row-key="id" />
      <Paginator class="mt-4" :rows="10" :totalRecords="45" />
    </section>

    <!-- ==================== 反馈类 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">反馈类</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button
          label="成功 Toast"
          variant="primary"
          @click="toastService.success('保存成功', '数据已写入')"
        />
        <Button
          label="错误 Toast"
          variant="danger"
          @click="toastService.error('操作失败', '请稍后重试')"
        />
        <Button
          label="信息 Toast"
          variant="secondary"
          @click="toastService.info('提示', '这是一条信息', 3000)"
        />
        <Button
          label="警告 Toast"
          variant="secondary"
          @click="toastService.warn('注意', '存在潜在风险')"
        />
        <Button
          label="带操作 Toast"
          variant="secondary"
          @click="
            toastService.add({
              variant: 'info',
              summary: '有新数据',
              detail: '点击刷新查看',
              action: { label: '立即刷新', handler: () => toastService.success('已刷新') },
            })
          "
        />
      </div>
      <!-- Toast 渲染容器（全局在 BaseLayout 已挂载，此处供独立验证） -->
      <Toast />
    </section>

    <!-- ==================== 浮层类 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">浮层类</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button label="打开 Dialog" variant="primary" @click="dialogOpen = true" />
        <Button label="打开 Drawer" variant="primary" @click="drawerOpen = true" />
        <Button
          label="打开 Confirm"
          variant="danger"
          @click="() => confirmService.require({ message: '确认执行此操作？' })"
        />
        <Dropdown v-model="dropdownOpen">
          <template #trigger>
            <Button icon="pi pi-ellipsis-v" variant="text" />
          </template>
          <div class="py-1">
            <button
              class="hover:bg-primary-100 dark:hover:bg-primary-800 block w-full px-3 py-1.5 text-left text-sm"
            >
              编辑
            </button>
            <button
              class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/40 block w-full px-3 py-1.5 text-left text-sm"
            >
              删除
            </button>
          </div>
        </Dropdown>
        <Popover v-model:open="popoverOpen">
          <template #trigger>
            <Button label="打开 Popover" variant="secondary" />
          </template>
          <div class="p-3 text-sm">Popover 内容区域</div>
        </Popover>
        <ContextMenu ref="contextMenuRef" :model="contextMenuItems" />
        <span
          class="border-primary-default rounded border border-dashed px-4 py-2 text-sm select-none"
          @contextmenu="(e: MouseEvent) => contextMenuRef?.show(e)"
          >右键点击我</span
        >
      </div>
    </section>

    <!-- ==================== 布局 / 滚动 ==================== -->
    <section class="bg-primary-card border-primary-default mb-6 rounded-lg border p-6">
      <h2 class="text-primary-heading mb-4 text-lg font-semibold">布局与滚动</h2>
      <ScrollArea class="border-primary-default h-32 rounded border">
        <div class="space-y-2 p-3">
          <p v-for="i in 20" :key="i" class="text-primary-body text-sm">滚动区域内容行 {{ i }}</p>
        </div>
      </ScrollArea>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card
          ><template #title>卡片一</template>
          <p class="text-primary-body text-sm">Card 组件内容。</p></Card
        >
        <CardItem><p class="text-primary-body text-sm">CardItem 组件内容。</p></CardItem>
        <Column><p class="text-primary-body text-sm">Column 组件内容。</p></Column>
      </div>
    </section>

    <!-- ==================== Dialog / Drawer 内容 ==================== -->
    <Dialog v-model:open="dialogOpen" title="对话框标题">
      <p class="text-primary-body text-sm">这是 Dialog 的内容区域，背景应为不透明的卡片色。</p>
      <template #footer>
        <Button label="取消" variant="secondary" @click="dialogOpen = false" />
        <Button label="确定" variant="primary" @click="dialogOpen = false" />
      </template>
    </Dialog>

    <Drawer v-model:open="drawerOpen" title="抽屉标题">
      <p class="text-primary-body p-4 text-sm">这是 Drawer 的内容区域。</p>
    </Drawer>
  </div>
</template>
