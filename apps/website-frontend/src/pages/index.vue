<template>
  <div class="min-h-screen">
    <!-- 顶部区域 -->
    <div
      class="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-4xl font-bold text-center mb-4">{{ $t('TSFullStack 在线工具集合') }}</h1>
      </div>
      <div class="flex"><CommonSettingBtns class="bg-white dark:bg-gray-800 rounded-lg px-3" /></div>
    </div>

    <!-- 内容介绍区域（骗审 + SEO） -->
    <section
      class="max-w-4xl mx-auto mt-12 px-4 sm:px-6 lg:px-8 text-gray-800 dark:text-gray-300 text-lg leading-relaxed">
      <h2 class="text-2xl font-semibold mb-4">{{ $t('平台介绍') }}</h2>
      <p class="mb-4">
        {{
          $t(
            'TSFullStack 是一个集成化的在线工具平台，汇聚了多个原创或深度整合的实用服务，覆盖内容管理、AI 计算、语言学习、虚拟展示等多场景需求。',
          )
        }}
      </p>
      <p class="mb-4">
        {{
          $t(
            '与传统工具站不同，TSFullStack 关注用户使用体验与功能组合的灵活性，所有工具均支持深度互动，适合开发者、设计师、教师及内容创作者使用。',
          )
        }}
      </p>
      <p class="mb-4">
        {{ $t('平台当前支持以下核心能力：') }}
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>{{ $t('基于自然语言解析的在线计算器 NoteCalc') }}</li>
        <li>{{ $t('支持 Web 全景浏览的虚拟展厅构建工具 VrImg') }}</li>
        <li>{{ $t('具备上下文联想与词义推荐的 AI 英语学习系统') }}</li>
        <li>{{ $t('权限清晰的企业级内容管理后台') }}</li>
      </ul>
      <p class="mb-4">
        {{ $t('我将持续改进交互体验与数据安全性，欢迎收藏本页以便长期使用。') }}
      </p>
    </section>

    <!-- 中部广告（可开启） -->
    <!-- <div class="max-w-4xl mx-auto px-4 my-10">
      <GoogleAd />
    </div> -->

    <!-- 工具功能区 -->
    <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Divider align="center">
        <span class="text-lg font-medium text-gray-700 dark:text-gray-300">
          {{ $t('当前发布的工具与服务') }}
        </span>
      </Divider>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
        <CardItem
          :title="$t('NoteCalc在线计算')"
          :description="$t('强大的在线计算工具，支持笔记和复杂计算')"
          :longDescription="$t('支持公式、注释、多行计算、单位换算等功能，适用于技术人员与学生。')"
          imageUrl="https://image.pollinations.ai/prompt/calculator%20application..."
          :routePath="routerUtil.to(routeMap.noteCalc, {})" />

        <CardItem
          :title="$t('VrImg全景虚拟展厅')"
          :description="$t('轻松构建企业的虚拟展厅/分享美景')"
          :longDescription="$t('支持360°全景图片浏览，可嵌入互动热点，适用于文旅、电商等场景。')"
          imageUrl="https://image.pollinations.ai/prompt/virtual%20exhibition%20hall..."
          :routePath="routerUtil.to(routeMap.VrImg, {})" />

        <CardItem
          :title="$t('AI英语学习')"
          :description="$t('在阅读中渐进式学习英语')"
          :longDescription="$t('提供阅读辅助、单词解释、语境联想等功能，提升英语阅读能力。')"
          imageUrl="https://image.pollinations.ai/prompt/English%20learning%20environment..."
          :routePath="routerUtil.to(routeMap.AiEnglish, undefined)" />
        <CardItem
          :title="$t('管理系统')"
          :description="$t('访问完整的管理后台，管理您的内容和设置')"
          :longDescription="$t('适用于企业或个人项目，提供完整的用户、权限、数据管理等模块。')"
          imageUrl="https://image.pollinations.ai/prompt/professional%20dashboard..."
          :routePath="routerUtil.to(routeMap.admin, {})" />
        <CardItem
          :title="$t('用户中心')"
          :description="$t('登录您的账户，访问个性化内容和设置')"
          :longDescription="$t('支持个人资料管理、任务记录查看、自定义偏好设置等功能。')"
          imageUrl="https://image.pollinations.ai/prompt/user%20profile%20interface..."
          :routePath="routerUtil.to(routeMap.login, {}, { r: $route.fullPath })" />
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
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
      title: { type: String as PropType<string>, required: true },
      description: { type: String as PropType<string>, required: true },
      longDescription: { type: String as PropType<string>, required: false },
      imageUrl: { type: String as PropType<string>, required: true },
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
              <img alt={props.title} src={props.imageUrl} class="w-full h-48 object-cover" />
            ),
            title: () => (
              <div class="text-xl font-bold text-gray-800 dark:text-gray-200">{props.title}</div>
            ),
            content: () => (
              <div>
                <p class="text-gray-600 dark:text-gray-400 mb-2">{props.description}</p>
                {props.longDescription && (
                  <p class="text-gray-500 dark:text-gray-500 text-sm">{props.longDescription}</p>
                )}
              </div>
            ),
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
