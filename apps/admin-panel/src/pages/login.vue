<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
      <div class="text-center">
        <h2 class="text-3xl font-extrabold text-gray-900">系统登录</h2>
        <p class="mt-2 text-sm text-gray-600">请输入您的账号和密码</p>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">用户名</label>
            <InputText
              id="username"
              v-model="form.username"
              type="text"
              required
              class="w-full mt-1"
              placeholder="请输入用户名" />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">密码</label>
            <Password
              id="password"
              v-model="form.password"
              :feedback="false"
              toggleMask
              required
              class="w-full mt-1"
              placeholder="请输入密码"
              inputClass="w-full" />
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <Checkbox v-model="rememberMe" id="remember" binary />
            <label for="remember" class="ml-2 block text-sm text-gray-700">记住我</label>
          </div>

          <div class="text-sm">
            <a href="#" class="font-medium text-blue-600 hover:text-blue-500">忘记密码?</a>
          </div>
        </div>

        <div>
          <Button type="submit" label="登录" class="w-full justify-center" :loading="loading" />
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';
  import Checkbox from 'primevue/checkbox';
  import { useToast } from 'primevue/usetoast';

  const toast = useToast();
  const router = useRouter();

  interface LoginForm {
    username: string;
    password: string;
  }

  const form = ref<LoginForm>({
    username: '',
    password: '',
  });

  const rememberMe = ref(false);
  const loading = ref(false);

  const handleLogin = async () => {
    loading.value = true;
    try {
      // 这里替换为实际的登录API调用
      // const response = await loginApi(form.value);
      console.log('登录信息:', form.value);

      // 模拟API延迟
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.add({
        severity: 'success',
        summary: '登录成功',
        detail: '欢迎回来',
        life: 3000,
      });

      router.push('/dashboard');
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: '登录失败',
        detail: '用户名或密码错误',
        life: 3000,
      });
    } finally {
      loading.value = false;
    }
  };
</script>

<style scoped>
  /* 可以添加一些自定义样式 */
</style>
