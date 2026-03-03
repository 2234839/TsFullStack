<template>
  <div class="min-h-screen bg-primary-50 dark:bg-primary-950">
    <!-- 顶部区域 -->
    <div class="flex justify-end pt-5 pr-3">
      <CommonSettingBtns class="bg-white dark:bg-primary-900 rounded-lg px-3 shadow-sm" />
    </div>

    <!-- 工具功能区 -->
    <div class="max-w-7xl mx-auto pb-12 px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <!--
          首页卡片图片生成说明

          所有卡片封面图均使用 AI 生成，风格为手绘水彩插画风格。
          生成方式：使用详细英文场景描述作为提示词，包含视觉元素、色彩、光照、氛围和艺术风格。图片比例4:3

          如需重新生成或修改图片，可使用以下 AI 图片生成服务：
          - Pollinations.ai: https://image.pollinations.ai/prompt/{encoded_prompt}?width=800&height=600&nologo=true
          - Midjourney、DALL-E 等 AI 绘图工具

          各卡片图片生成提示词：
        -->

        <!-- NoteCalc: modern calculator interface with mathematical formulas floating in elegant typography, clean white background with subtle blue accent lighting, professional productivity tool aesthetic, hand drawn watercolor illustration style -->
        <CardItem :title="t('NoteCalc在线计算')" :longDescription="t('支持公式、注释、多行计算、单位换算等功能，适用于技术人员与学生。')"
          imageUrl="/index-image/notecalc.webp" :routePath="routerUtil.to(routeMap.noteCalc, {})" />

        <!-- 暂时隐藏，因为实现的还不够好 -->
        <!-- <CardItem
          :title="t('VrImg全景虚拟展厅')"
          :longDescription="t('支持360°全景图片浏览，可嵌入互动热点，适用于文旅、电商等场景。')"
          :imageUrl="generateAIImage('immersive 360 degree virtual reality gallery with floating interactive hotspots, warm ambient lighting, museum exhibition space with modern art installations')"
          :routePath="routerUtil.to(routeMap.VrImg, {})" /> -->

        <!-- AI英语学习: open book with glowing English words floating upward, warm desk lamp lighting, cozy study atmosphere with notebook and pen, language learning concept, hand drawn watercolor illustration style -->
        <CardItem :title="t('AI英语学习')" :longDescription="t('提供阅读辅助、单词解释、语境联想等功能，提升英语阅读能力。')"
          imageUrl="/index-image/ai english.webp" :routePath="routerUtil.to(routeMap.AiEnglish, undefined)" />

        <!-- 树洞: hand drawn watercolor illustration of a magical tree with a hollow trunk, warm glowing light coming from inside the tree hole, secretive and cozy atmosphere, soft pastel colors, ink outline style, small papers and notes floating around, nature theme with whimsical artistic feeling, children's book illustration style -->
        <CardItem :title="t('树洞')" :longDescription="t('一个安全的树洞空间，支持公开、会员可见、私有等多种分享方式。')"
          imageUrl="/index-image/treehole.webp" :routePath="routerUtil.to(routeMap.treehole, {})" />

        <!-- 管理系统: professional dashboard admin panel with data visualization charts and graphs, modern dark theme interface, clean organized layout with statistics and analytics, hand drawn watercolor illustration style -->
        <CardItem :title="t('管理系统')" :longDescription="t('适用于企业或个人项目，提供完整的用户、权限、数据管理等模块。')"
          imageUrl="/index-image/管理系统.webp" :routePath="routerUtil.to(routeMap.admin, {})" />

        <!-- 用户中心: user profile interface with personalized settings and preferences, friendly modern design with avatar and organized menu options, welcoming user experience, hand drawn watercolor illustration style -->
        <CardItem :title="t('用户中心')" :longDescription="t('支持个人资料管理、任务记录查看、自定义偏好设置等功能。')"
          imageUrl="/index-image/用户中心.webp" :routePath="userCenterRoute" />
      </div>
    </div>
    <SponsorshipCard />
  </div>
</template>

<script setup lang="tsx">
  import SponsorshipCard from '@/components/SponsorshipCard.vue';
import { useI18n } from '@/composables/useI18n';
import { routeMap, routerUtil } from '@/router';
import { authInfo_isLogin } from '@/storage';
import { computed, defineComponent, type PropType } from 'vue';
import {
  RouterLink,
  useRoute,
  type RouteLocationAsPathGeneric,
  type RouteLocationAsRelativeGeneric,
} from 'vue-router';

  const { t } = useI18n();
  const route = useRoute();

  /** 用户中心卡片跳转路径 - 已登录跳转到个人设置，未登录跳转到登录页 */
  const userCenterRoute = computed(() => {
    if (authInfo_isLogin.value) {
      return routerUtil.to(routeMap.admin.child.userSettings, {});
    }
    return routerUtil.to(routeMap.login, {}, { r: route.fullPath });
  });

  const CardItem = defineComponent({
    props: {
      title: { type: String as PropType<string>, required: true },
      description: { type: String as PropType<string>, required: false },
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
        <RouterLink to={props.routePath} class="group block">
          <div class="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer h-64">
            {/* 背景图片 */}
            <img
              alt={props.title}
              src={props.imageUrl}
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />

            {/* 渐变遮罩 - 从透明到深色 */}
            <div class="absolute inset-0 bg-gradient-to-t from-primary-950/90 via-primary-950/40 to-transparent" />

            {/* 内容区域 */}
            <div class="absolute inset-0 p-6 flex flex-col justify-end">
              {/* 标题 */}
              <h3 class="text-2xl font-bold text-primary-50 mb-2 drop-shadow-lg">
                {props.title}
              </h3>

              {/* 长描述 - 悬停时显示 */}
              {props.longDescription && (
                <p class="text-primary-200 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-md line-clamp-2">
                  {props.longDescription}
                </p>
              )}
            </div>

            {/* 悬停时的微妙边框高亮 */}
            <div class="absolute inset-0 border-2 border-primary-50/0 group-hover:border-primary-50/30 rounded-xl transition-colors duration-300 pointer-events-none" />
          </div>
        </RouterLink>
      );
    },
  });
</script>
