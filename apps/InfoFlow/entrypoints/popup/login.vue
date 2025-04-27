<template>
  <div class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
    <h2 class="text-2xl font-bold mb-6 text-center">Login</h2>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label for="email" class="block text-sm font-medium">Email</label>
        <InputText
          id="email"
          v-model="form.email"
          type="email"
          required
          placeholder="Enter your email"
          class="w-full" />
      </div>
      <div class="space-y-2">
        <label for="password" class="block text-sm font-medium">Password</label>
        <Password
          id="password"
          v-model="form.password"
          :feedback="false"
          toggleMask
          required
          placeholder="Enter your password"
          class="w-full" />
      </div>
      <Button type="submit" :loading="isLoading" label="Login" class="w-full" />
      <Message v-if="error" severity="error">{{ error }}</Message>
    </form>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { AppAPI } from '@/utils/api';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';
  import Message from 'primevue/message';
  import { authStore } from '@/storage/auth';
  import { useToast } from 'primevue';

  const form = ref({
    email: '',
    password: '',
  });

  const isLoading = ref(false);
  const error = ref('');

  const toast = useToast();
  const handleSubmit = async () => {
    if (!form.value.email || !form.value.password) {
      error.value = 'Please fill in all fields';
      return;
    }

    try {
      isLoading.value = true;
      error.value = '';
      const auth = await AppAPI.system.loginByEmailPwd(form.value.email, form.value.password);
      authStore.value.token = auth.token;
      authStore.value.userId = auth.userId;
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Login successful',
        life: 3000,
      });
    } catch (err) {
      error.value = 'Login failed. Please check your credentials.';
      console.error('Login error:', err);
    } finally {
      isLoading.value = false;
    }
  };
</script>
