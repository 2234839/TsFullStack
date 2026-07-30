<template>
  <Card>
    <template #title>
      <div class="flex items-center gap-2">
        <span class="font-bold">{{ scenario.name }}</span>
        <Tag :value="statusLabel" :variant="statusVariant" />
      </div>
    </template>

    <template #subtitle>
      <div class="flex flex-wrap gap-3 text-sm text-gray-500">
        <span v-if="scenario.duration">{{ t("耗时") }}: {{ scenario.duration }}ms</span>
        <span v-if="scenario.pixelDiffPercent !== null">
          {{ t("像素差异") }}: {{ scenario.pixelDiffPercent.toFixed(2) }}%
        </span>
        <span
          >{{ t("DOM 结构") }}:
          <b :class="scenario.domPassed ? 'text-green-600' : 'text-red-500'">
            {{ scenario.domPassed ? t("通过") : t("差异") }}
          </b>
        </span>
      </div>
    </template>

    <template #content>
      <!-- 错误信息 -->
      <div v-if="scenario.error" class="mb-3 rounded bg-red-50 p-3 text-sm text-red-600">
        <i class="pi pi-exclamation-triangle mr-1" />
        {{ scenario.error }}
      </div>

      <!-- DOM diff -->
      <div v-if="scenario.domDiff" class="mb-3 rounded bg-orange-50 p-3">
        <p class="mb-1 font-semibold text-orange-700">{{ t("DOM 结构差异") }}</p>
        <pre class="overflow-x-auto whitespace-pre-wrap text-xs text-orange-800">{{
          scenario.domDiff
        }}</pre>
      </div>

      <!-- 图片对比 -->
      <div v-if="showImageCompare" class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <!-- 基准截图 -->
        <div class="overflow-hidden rounded border">
          <p class="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{{ t("基准") }}</p>
          <img
            v-if="images.baseline"
            :src="`data:image/png;base64,${images.baseline}`"
            :alt="t('基准截图')"
            class="w-full cursor-zoom-in"
            @click="previewImage = { src: images.baseline, title: t('基准截图') }"
          />
          <div v-else class="flex h-32 items-center justify-center text-sm text-gray-400">
            {{ t("无基准") }}
          </div>
        </div>

        <!-- 当前截图 -->
        <div class="overflow-hidden rounded border">
          <p class="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{{ t("当前") }}</p>
          <img
            v-if="images.current"
            :src="`data:image/png;base64,${images.current}`"
            :alt="t('当前截图')"
            class="w-full cursor-zoom-in"
            @click="previewImage = { src: images.current, title: t('当前截图') }"
          />
          <div v-else class="flex h-32 items-center justify-center text-sm text-gray-400">-</div>
        </div>

        <!-- diff 图 -->
        <div class="overflow-hidden rounded border">
          <p class="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{{ t("差异") }}</p>
          <img
            v-if="images.diff"
            :src="`data:image/png;base64,${images.diff}`"
            :alt="t('差异图')"
            class="w-full cursor-zoom-in"
            @click="previewImage = { src: images.diff, title: t('差异图') }"
          />
          <div v-else class="flex h-32 items-center justify-center text-sm text-gray-400">-</div>
        </div>
      </div>

      <!-- 图片预览：全屏遮罩 + 滚轮缩放 + 拖拽平移 -->
      <Teleport to="body">
        <div
          v-if="previewImage"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          @wheel.prevent="handleWheel"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
          @click.self="previewImage = null"
        >
          <!-- 工具栏 -->
          <div class="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
              @click="resetZoom"
            >
              {{ t("重置") }}
            </button>
            <button
              class="rounded bg-white/20 px-3 py-1 text-sm text-white hover:bg-white/30"
              @click="previewImage = null"
            >
              ✕ {{ t("关闭") }}
            </button>
          </div>

          <!-- 缩放比例提示 -->
          <div class="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-xs text-white">
            {{ Math.round(zoom * 100) }}%
          </div>

          <!-- 图片容器 -->
          <div
            class="overflow-hidden"
            :style="{
              transform: `translate(${dragX}px, ${dragY}px) scale(${zoom})`,
              cursor: isDragging ? 'grabbing' : 'grab',
              maxWidth: '90vw',
              maxHeight: '90vh',
            }"
          >
            <img
              :src="`data:image/png;base64,${previewImage.src}`"
              :alt="previewImage.title"
              class="block max-w-none"
              :style="{ width: imgNaturalWidth + 'px' }"
              draggable="false"
            />
          </div>
        </div>
      </Teleport>

      <!-- 操作按钮 -->
      <div class="mt-3 flex gap-2">
        <Button
          v-if="canApprove"
          :label="t('批准')"
          icon="pi pi-check"
          variant="primary"
          size="sm"
          :loading="approving"
          @click="approve"
        />
        <Button
          v-if="canReject"
          :label="t('拒绝')"
          icon="pi pi-times"
          variant="danger"
          size="sm"
          :loading="rejecting"
          @click="reject"
        />
        <Button
          :label="t('重新运行')"
          icon="pi pi-refresh"
          size="sm"
          variant="text"
          :loading="rerunning"
          @click="rerun"
        />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button, Card, Tag } from "@/components/base";
import { useI18n } from "@/composables/useI18n";
import type { ScenarioResult, VisualTestAPI } from "@tsfullstack/visual-test";

const props = defineProps<{
  scenario: ScenarioResult;
  rpc: VisualTestAPI & { health?: () => Promise<unknown> };
}>();

const emit = defineEmits<{
  approved: [];
  rejected: [];
}>();

const { t } = useI18n();

/** 图片数据 */
const images = ref<{ baseline: string | null; current: string | null; diff: string | null }>({
  baseline: null,
  current: null,
  diff: null,
});

/** 按钮加载状态 */
const approving = ref(false);
const rejecting = ref(false);
const rerunning = ref(false);

/** 图片预览 */
const previewImage = ref<{ src: string; title: string } | null>(null);

/** 缩放级别（1 = 原始尺寸） */
const zoom = ref(1);
/** 拖拽偏移 */
const dragX = ref(0);
const dragY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
/** 图片原始宽度（从 base64 加载后获取） */
const imgNaturalWidth = ref(800);

/** 打开预览时加载图片获取原始尺寸 */
watch(previewImage, (val) => {
  if (val) {
    zoom.value = 1;
    dragX.value = 0;
    dragY.value = 0;
    const img = new Image();
    img.onload = () => {
      imgNaturalWidth.value = img.naturalWidth;
    };
    img.src = `data:image/png;base64,${val.src}`;
  }
});

/** 滚轮缩放 */
function handleWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  zoom.value = Math.min(Math.max(zoom.value + delta, 0.2), 5);
}

/** 开始拖拽 */
function startDrag(e: MouseEvent) {
  isDragging.value = true;
  dragStartX.value = e.clientX - dragX.value;
  dragStartY.value = e.clientY - dragY.value;
}

/** 拖拽中 */
function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  dragX.value = e.clientX - dragStartX.value;
  dragY.value = e.clientY - dragStartY.value;
}

/** 结束拖拽 */
function endDrag() {
  isDragging.value = false;
}

/** 重置缩放和位置 */
function resetZoom() {
  zoom.value = 1;
  dragX.value = 0;
  dragY.value = 0;
}

/** 状态标签 */
const statusLabel = computed(() => {
  const map: Record<string, string> = {
    approved: t("已批准"),
    failed: t("回归"),
    pendingNew: t("待批准（新）"),
    pendingDiff: t("待审批（差异）"),
    rejected: t("已拒绝"),
    error: t("错误"),
  };
  return map[props.scenario.status] ?? props.scenario.status;
});

/** 状态变体 */
const statusVariant = computed<"success" | "warn" | "danger" | "secondary">(() => {
  const map: Record<string, "success" | "warn" | "danger" | "secondary"> = {
    approved: "success",
    failed: "danger",
    pendingNew: "warn",
    pendingDiff: "warn",
    rejected: "danger",
    error: "danger",
  };
  return map[props.scenario.status] ?? "secondary";
});

/** 是否显示图片对比 */
const showImageCompare = computed(() => {
  return props.scenario.status !== "error" && (images.value.baseline || images.value.current);
});

/** 是否可批准 */
const canApprove = computed(
  () => props.scenario.status === "pendingNew" || props.scenario.status === "pendingDiff",
);

/** 是否可拒绝 */
const canReject = computed(
  () => props.scenario.status === "pendingNew" || props.scenario.status === "pendingDiff",
);

/** 加载图片 */
async function loadImages() {
  const [baseline, current, diff] = await Promise.all([
    props.rpc.getImage("baseline", props.scenario.name).catch(() => null),
    props.rpc.getImage("current", props.scenario.name).catch(() => null),
    props.rpc.getImage("diff", props.scenario.name).catch(() => null),
  ]);
  images.value = { baseline, current, diff };
}

/** 批准 */
async function approve() {
  approving.value = true;
  try {
    await props.rpc.approve(props.scenario.name);
    emit("approved");
  } finally {
    approving.value = false;
  }
}

/** 拒绝 */
async function reject() {
  rejecting.value = true;
  try {
    await props.rpc.reject(props.scenario.name);
    emit("rejected");
  } finally {
    rejecting.value = false;
  }
}

/** 重新运行 */
async function rerun() {
  rerunning.value = true;
  try {
    await props.rpc.runOne(props.scenario.name);
    emit("rejected");
  } finally {
    rerunning.value = false;
  }
}

/** 场景变化时重新加载图片 */
watch(
  () => props.scenario.name + props.scenario.status,
  () => loadImages(),
  { immediate: true },
);
</script>
