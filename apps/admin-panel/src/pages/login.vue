<template>
  <div
    class="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-500"
    :class="isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'">
    <!-- 炫酷背景 -->
    <div
      class="absolute inset-0 transition-all duration-500"
      :class="
        isDarkMode
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-teal-900'
          : 'bg-gradient-to-br from-blue-100 via-cyan-200 to-teal-100'
      ">
      <!-- 动态背景元素 -->
      <div class="stars-container" v-if="isDarkMode">
        <div v-for="n in 20" :key="`star-${n}`" class="star" :style="getRandomStarStyle()"></div>
      </div>

      <!-- 光效元素 -->
      <div
        class="glow-effect glow-1"
        :class="isDarkMode ? 'bg-teal-500/30' : 'bg-teal-300/40'"></div>
      <div
        class="glow-effect glow-2"
        :class="isDarkMode ? 'bg-blue-500/30' : 'bg-blue-300/40'"></div>
      <div
        class="glow-effect glow-3"
        :class="isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-300/30'"></div>

      <!-- 动态光线 -->
      <div
        class="light-beam light-beam-1"
        :class="isDarkMode ? 'bg-gradient-dark' : 'bg-gradient-light'"></div>
      <div
        class="light-beam light-beam-2"
        :class="isDarkMode ? 'bg-gradient-dark' : 'bg-gradient-light'"></div>

      <!-- 网格效果 -->
      <div class="grid-overlay" :class="isDarkMode ? 'grid-dark' : 'grid-light'"></div>
    </div>

    <!-- 主题切换按钮 -->
    <div class="absolute top-4 right-4 z-20">
      <ThemeSwitcher />
    </div>

    <div
      class="w-full max-w-md p-8 space-y-6 rounded-2xl shadow-2xl border transition-all duration-300 relative z-10"
      :class="
        isDarkMode
          ? 'bg-gray-800/40 backdrop-blur-xl border-gray-700/30 hover:shadow-teal-500/20'
          : 'bg-white/90 backdrop-blur-sm border-gray-200 hover:shadow-teal-500/10'
      ">
      <!-- 卡片内部光晕 -->
      <div
        class="absolute pointer-events-none -inset-0.5 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"
        :class="
          isDarkMode
            ? 'bg-gradient-to-r from-teal-500 to-blue-600'
            : 'bg-gradient-to-r from-cyan-400 to-teal-500'
        "></div>

      <!-- 顶部Logo和标题 -->
      <div class="text-center">
        <div class="flex justify-center mb-4">
          <div
            class="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg animate-pulse-slow"
            :class="
              isDarkMode
                ? 'bg-gradient-to-r from-teal-500 to-blue-600 shadow-teal-500/30'
                : 'bg-gradient-to-r from-cyan-500 to-teal-600 shadow-teal-500/20'
            ">
            <i class="pi pi-shield text-white text-3xl"></i>
          </div>
        </div>
        <h2
          class="text-3xl font-extrabold bg-clip-text text-transparent animate-gradient"
          :class="
            isDarkMode
              ? 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400'
              : 'bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600'
          ">
          系统登录
        </h2>
        <p class="mt-2 text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-600'">
          欢迎回来，请输入您的账号和密码
        </p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleLogin">
        <div class="space-y-4">
          <!-- 用户名输入框 -->
          <div class="group">
            <label
              for="username"
              class="block text-sm font-medium mb-1"
              :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
              <i
                class="pi pi-user mr-2"
                :class="isDarkMode ? 'text-gray-300' : 'text-gray-500'" />用户名
            </label>

            <InputText
              id="username"
              v-model="form.username"
              required
              class="w-full"
              placeholder="请输入用户名" />
          </div>

          <!-- 密码输入框 -->
          <div class="group">
            <label
              for="password"
              class="block text-sm font-medium mb-1"
              :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
              <i
                class="pi pi-lock mr-2"
                :class="isDarkMode ? 'text-gray-300' : 'text-gray-500'" />密码
            </label>
            <Password
              id="password"
              v-model="form.password"
              toggleMask
              required
              class="w-full"
              inputClass="w-full"
              placeholder="请输入密码" />
          </div>
        </div>

        <!-- 记住我和忘记密码 -->
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <Checkbox v-model="rememberMe" id="remember" binary />
            <label
              for="remember"
              class="ml-2 block text-sm"
              :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
              记住我
            </label>
          </div>

          <div class="text-sm">
            <a
              href="#"
              class="font-medium transition-colors"
              :class="
                isDarkMode
                  ? 'text-teal-400 hover:text-teal-300'
                  : 'text-teal-600 hover:text-teal-500'
              ">
              忘记密码?
            </a>
          </div>
        </div>

        <!-- 登录按钮 -->
        <div class="space-y-3">
          <Button
            v-if="authInfo_isLogin"
            label="已处于登录状态, 点击跳转首页"
            icon="pi pi-home"
            @click="routerUtil.push(routeMap.admin, {})"
            class="w-full justify-center" />

          <Button type="submit" class="w-full justify-center" :loading="loading">
            <template #default>
              <span class="flex items-center">
                <i class="pi pi-sign-in mr-2"></i>
                <span>登录</span>
              </span>
            </template>
          </Button>
        </div>
      </form>

      <!-- 底部额外信息 -->
      <div
        class="pt-4 text-center text-xs border-t"
        :class="isDarkMode ? 'text-gray-400 border-gray-700/30' : 'text-gray-500 border-gray-200'">
        <p>
          还没有账号?
          <a
            href="#"
            class="hover:underline"
            :class="isDarkMode ? 'text-teal-400' : 'text-teal-600'">
            立即注册
          </a>
        </p>
      </div>
    </div>

    <!-- 动态光圈效果 - 跟随鼠标 -->
    <div
      ref="cursorLight"
      class="cursor-light"
      :class="isDarkMode ? 'cursor-light-dark' : 'cursor-light-light'"></div>
  </div>
</template>

<script setup lang="ts">
  import ThemeSwitcher from '@/components/ThemeSwitch.vue';
  import Button from 'primevue/button';
  import Checkbox from 'primevue/checkbox';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import { useToast } from 'primevue/usetoast';
  import { onMounted, onUnmounted, ref } from 'vue';
  import { AppAPI } from '@/api';
  import { routeMap, routerUtil } from '@/router';
  import { authInfo, authInfo_isLogin, theme_isDark } from '@/storage';

  const toast = useToast();
  const cursorLight = ref<HTMLElement | null>(null);
  const isDarkMode = theme_isDark;
  const rememberMe = ref(false);
  const loading = ref(false);

  interface LoginForm {
    username: string;
    password: string;
  }

  const form = ref<LoginForm>({
    username: 'admin@example.com',
    password: 'adminpassword123',
  });

  // 生成随机星星样式
  const getRandomStarStyle = () => {
    const size = Math.random() * 4 + 1;
    const top = Math.random() * 100;
    const left = Math.random() * 100;
    const animationDuration = Math.random() * 3 + 2;
    const delay = Math.random() * 5;

    return {
      width: `${size}px`,
      height: `${size}px`,
      top: `${top}%`,
      left: `${left}%`,
      animationDuration: `${animationDuration}s`,
      animationDelay: `${delay}s`,
    };
  };

  // 鼠标跟随效果
  const handleMouseMove = (e: MouseEvent) => {
    if (cursorLight.value) {
      cursorLight.value.style.left = `${e.clientX}px`;
      cursorLight.value.style.top = `${e.clientY}px`;
    }
  };

  const handleLogin = async () => {
    loading.value = true;
    try {
      const res = await AppAPI.system.loginByEmailPwd(form.value.username, form.value.password);

      authInfo.value = { userId: res.userId, token: res.token, expiresAt: res.expiresAt.getTime() };

      // 使用更吸引人的成功提示
      toast.add({
        severity: 'success',
        summary: '登录成功',
        detail: '欢迎回来，正在为您跳转...',
        life: 3000,
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        routerUtil.push(routeMap.admin, {});
      }, 1000);
    } catch (error) {
      console.log('[error]', error);
      toast.add({
        severity: 'error',
        summary: '登录失败',
        detail: (error as Error).message,
        life: 3000,
      });
    } finally {
      loading.value = false;
    }
  };
  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove);
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove);
  });
</script>

<style scoped>
  /* 动画效果 */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-20px);
    }
    100% {
      transform: translateY(0px);
    }
  }

  @keyframes pulse-slow {
    0% {
      box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.7);
    }
    70% {
      box-shadow: 0 0 0 15px rgba(20, 184, 166, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
    }
  }

  @keyframes gradient-shift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes twinkle {
    0% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.2;
    }
  }

  @keyframes beam-move {
    0% {
      transform: translateX(-100%) rotate(45deg);
      opacity: 0;
    }
    20% {
      opacity: 0.7;
    }
    80% {
      opacity: 0.7;
    }
    100% {
      transform: translateX(100%) rotate(45deg);
      opacity: 0;
    }
  }

  /* 应用动画 */
  form {
    animation: fadeIn 0.5s ease-out;
  }

  .animate-pulse-slow {
    animation: pulse-slow 2s infinite;
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient-shift 3s ease infinite;
  }

  /* 星星效果 */
  .stars-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .star {
    position: absolute;
    background-color: white;
    border-radius: 50%;
    animation: twinkle 3s infinite;
  }

  /* 炫酷背景元素 */
  .glow-effect {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
  }

  .glow-1 {
    top: 20%;
    left: 15%;
    width: 300px;
    height: 300px;
    animation: float 8s ease-in-out infinite;
  }

  .glow-2 {
    bottom: 10%;
    right: 15%;
    width: 250px;
    height: 250px;
    animation: float 10s ease-in-out infinite;
  }

  .glow-3 {
    top: 50%;
    left: 50%;
    width: 350px;
    height: 350px;
    animation: float 12s ease-in-out infinite;
  }

  /* 光束效果 */
  .light-beam {
    position: absolute;
    height: 150px;
    width: 100%;
    transform: rotate(45deg);
  }

  .bg-gradient-dark {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  }

  .bg-gradient-light {
    background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.05), transparent);
  }

  .light-beam-1 {
    top: 20%;
    animation: beam-move 8s linear infinite;
  }

  .light-beam-2 {
    top: 60%;
    animation: beam-move 12s linear infinite;
  }

  /* 网格效果 */
  .grid-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .grid-dark {
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .grid-light {
    background-image: linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* 鼠标跟随光效 */
  .cursor-light {
    position: fixed;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
    mix-blend-mode: screen;
  }

  .cursor-light-dark {
    background: radial-gradient(circle, rgba(20, 184, 166, 0.2) 0%, rgba(20, 184, 166, 0) 70%);
  }

  .cursor-light-light {
    background: radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0) 70%);
    mix-blend-mode: multiply;
  }
</style>
