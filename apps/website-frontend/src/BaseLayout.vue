<template>
  <div class="min-h-screen bg-primary-surface text-primary-heading">
    <RouterView v-slot="{ Component, route: innerRoute }">
      <template v-if="Component">
        <Transition mode="out-in">
          <KeepAlive v-if="innerRoute.meta.keepAlive">
            <Suspense>
              <component :is="Component" />
              <template #fallback>
                <div class="flex items-center justify-center min-h-screen">
                  <div class="text-center">
                    <ProgressSpinner />
                    <p class="mt-4 text-primary-theme">{{ t("正在加载...") }}</p>
                  </div>
                </div>
              </template>
            </Suspense>
          </KeepAlive>
          <Suspense v-else>
            <component :is="Component" />
            <template #fallback>
              <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                  <ProgressSpinner />
                  <p class="mt-4 text-primary-theme">{{ t("正在加载...") }}</p>
                </div>
              </div>
            </template>
          </Suspense>
        </Transition>
      </template>
    </RouterView>

    <Toast />
    <Confirm />
    <GithubStar v-if="!route.meta.bare" />
    <TestWarningBanner v-if="!route.meta.bare" />
  </div>
</template>

<script setup lang="ts">
import GithubStar from "@/components/system/GithubStar.vue";
import TestWarningBanner from "@/components/system/TestWarningBanner.vue";
import { allRoutes, findRouteNode } from "@/router";
import { useTitle } from "@vueuse/core";
import Toast from "@/components/system/Toast.vue";
import { computed, onUnmounted, onErrorCaptured } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useI18n } from "@/composables/useI18n";
import { startUpdatePolling } from "@/composables/useUpdateChecker";

const { t } = useI18n();
import { toastBus, authBus } from "@/buses";
import { authInfo_logout } from "@/storage";
import { MsgError } from "@tsfullstack/backend";

//#region 设置页面标题
const route = useRoute();
const routeNode = computed(() => findRouteNode(allRoutes, (el) => el.name === route.name));
const title = computed(() => {
  return routeNode.value?.meta?.title
    ? `${routeNode.value.meta.title} - TSFullStack`
    : "TSFullStack";
});
useTitle(title);
//#endregion

//#region Toast 订阅
const toast = useToast();

// 订阅 toastBus，将所有消息显示到 Toast 组件
const unsubscribeToast = toastBus.subscribe((message) => {
  toast.add(message);
});

// 订阅 authBus，处理登出事件
const unsubscribeAuth = authBus.subscribe(MsgError.op_logout, () => {
  authInfo_logout();
});

onUnmounted(() => {
  unsubscribeToast();
  unsubscribeAuth();
});

//#region 更新检测
/** 启动轮询，检测到新版本时弹 toast 提示用户刷新（不自动刷新，让用户自己决定时机） */
startUpdatePolling(() => {
  toast.add({
    variant: "info",
    summary: t("发现新版本"),
    detail: t("系统已更新，建议刷新页面以获取最新版本。"),
    action: {
      label: t("立即刷新"),
      handler: () => window.location.reload(),
    },
  });
});
//#endregion

/** 全局错误边界：捕获子组件中未处理的异步错误，通过 toast 通知用户而非白屏 */
onErrorCaptured((_instance, error) => {
  /** 安全地提取错误信息，避免循环引用导致 JSON.stringify 崩溃 */
  let errMsg: string;
  if (error instanceof Error) {
    errMsg = error.message;
  } else if (typeof error === "string") {
    errMsg = error;
  } else {
    try {
      errMsg = JSON.stringify(error)?.slice(0, 200) ?? String(error);
    } catch {
      errMsg = String(error);
    }
  }
  console.error("[ErrorBoundary]", errMsg, error);
  toast.add({
    variant: "danger",
    summary: t("运行时错误"),
    detail: errMsg.slice(0, 200),
    life: 5000,
  });
});
//#endregion
</script>
