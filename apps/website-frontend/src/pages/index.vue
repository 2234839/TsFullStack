<template>
  <div class="min-h-screen">
    <!-- 头部区域 -->
    <div
      class="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-4xl font-bold text-center mb-4">{{ $t('TSFullStack') }}</h1>
      </div>
      <div><ThemeToggle /></div>
    </div>

    <!-- 功能卡片区域 -->
    <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Divider align="center">
        <span class="text-lg font-medium text-gray-700 dark:text-gray-300">{{
          $t('功能导航')
        }}</span>
      </Divider>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
        <!-- 管理系统卡片 -->
        <CardItem
          :title="$t('管理系统')"
          :description="$t('访问完整的管理后台，管理您的内容和设置')"
          imageUrl="https://image.pollinations.ai/prompt/professional%20dashboard%20system%20interface,%20digital%20art?width=600&height=400&seed=1234&enhance=true&nologo=true&model=flux"
          :routePath="routerUtil.to(routeMap.admin, {})" />
        <!-- NoteCalc卡片 -->
        <CardItem
          :title="$t('NoteCalc在线计算')"
          :description="$t('强大的在线计算工具，支持笔记和复杂计算')"
          imageUrl="https://image.pollinations.ai/prompt/calculator%20application%20interface,%20colorful,%20modern%20design?width=600&height=400&seed=5678&enhance=true&nologo=true&model=flux"
          :routePath="routerUtil.to(routeMap.noteCalc, {})" />

        <!-- VRImg卡片 -->
        <CardItem
          :title="$t('VrImg全景虚拟展厅')"
          :description="$t('轻松构建企业的虚拟展厅/分享美景')"
          imageUrl="https://image.pollinations.ai/prompt/virtual%20exhibition%20hall,%20modern%20design,%20immersive%203D%20environment,%20clean%20interface?width=600&height=400&seed=5678&enhance=true&nologo=true&model=flux"
          :routePath="routerUtil.to(routeMap.VrImg, {})" />

        <!-- AI英语学习卡片 -->
        <CardItem
          :title="$t('AI英语学习')"
          :description="$t('在阅读中渐进式学习英语')"
          imageUrl="https://image.pollinations.ai/prompt/English%20learning%20environment,%20immersive%20reading,%20clean%20interface,%20modern%20design,%20AI%20assistant,%20educational%20tools?width=600&height=400&seed=1234&enhance=true&nologo=true&model=flux"
          :routePath="routerUtil.to(routeMap.AiEnglish, undefined)" />
        <!-- 用户中心卡片 -->
        <CardItem
          :title="$t('用户中心')"
          :description="$t('登录您的账户，访问个性化内容和设置')"
          imageUrl="https://image.pollinations.ai/prompt/user%20profile%20interface,%20login%20screen,%20modern%20UI?width=600&height=400&seed=9012&enhance=true&nologo=true&model=flux"
          :routePath="routerUtil.to(routeMap.login, {}, { r: $route.fullPath })" />
      </div>
    </div>

    <GoogleAd />
  </div>
</template>

<script setup lang="tsx">
  import GoogleAd from '@/components/GoogleAd.vue';
  import ThemeToggle from '@/components/system/ThemeToggle.vue';
  import { routeMap, routerUtil } from '@/router';
  import { Button, Card, Divider } from 'primevue';
  import { defineComponent, type PropType } from 'vue';
  import {
    RouterLink,
    type RouteLocationAsPathGeneric,
    type RouteLocationAsRelativeGeneric,
  } from 'vue-router';

  const CardItem = defineComponent({
    props: {
      title: {
        type: String as PropType<string>,
        required: true,
      },
      description: {
        type: String as PropType<string>,
        required: true,
      },
      imageUrl: {
        type: String as PropType<string>,
        required: true,
      },
      routePath: {
        type: Object as PropType<
          string | RouteLocationAsRelativeGeneric | RouteLocationAsPathGeneric
        >,
        required: true,
      },
    },
    setup(props) {
      return () => (
        <Card class="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800">
          {{
            header: () => (
              <img alt="NoteCalc" src={props.imageUrl} class="w-full h-48 object-cover" />
            ),
            title: () => (
              <div class="text-xl font-bold text-gray-800 dark:text-gray-200">{props.title}</div>
            ),
            content: () => <p class="text-gray-600 dark:text-gray-400 mb-4">{props.description}</p>,
            footer: () => (
              <RouterLink to={props.routePath} class="block w-full">
                <Button label={props.title} class="p-button-success w-full" />
              </RouterLink>
            ),
          }}
        </Card>
      );
    },
  });
</script>
