<template>
  <div class="payment-config-page p-6 max-w-4xl mx-auto">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-primary-900 dark:text-primary-50 flex items-center gap-2">
        <i class="pi pi-wallet text-primary-600" />
        {{ t('支付配置') }}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('配置支付渠道和密钥信息') }}</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- 面包多配置 -->
      <Card class="p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-primary-800 dark:text-primary-50 flex items-center gap-2">
            <i class="pi pi-wallet" /> {{ t('面包多 (MBD)') }}
          </h2>
          <ToggleSwitch :modelValue="config.mbd.enabled" @update:model-value="(v: boolean) => config.mbd.enabled = v" />
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('App ID') }}</label>
            <Input v-model="config.mbd.appId" :placeholder="t('从面包多开发者后台获取')" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('App Key (签名密钥)') }}</label>
            <Password v-model="config.mbd.appKey" :placeholder="t('用于签名验证，请妥善保管')" :feedback="false" :toggleMask="undefined" />
          </div>
        </div>
      </Card>

      <!-- 爱发电配置 -->
      <Card class="p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-primary-800 dark:text-primary-50 flex items-center gap-2">
            <i class="pi pi-heart" /> {{ t('爱发电 (AFDIAN)') }}
          </h2>
          <ToggleSwitch :modelValue="config.afdian.enabled" @update:model-value="(v: boolean) => config.afdian.enabled = v" />
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('User ID') }}</label>
            <Input v-model="config.afdian.userId" :placeholder="t('爱发电创作者 User ID')" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('API Token') }}</label>
            <Password v-model="config.afdian.apiKey" :placeholder="t('API 调用签名用 Token')" :feedback="false" :toggleMask="undefined" />
          </div>
          <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <i class="pi pi-info-circle mr-1"></i>
            {{ t('Webhook URL 已自动配置为: /webhook/afdian，请在爱发电开发者后台填入此地址') }}
          </div>
        </div>

        <!-- Webhook 测试按钮 -->
        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            :label="testingWebhook ? t('测试中...') : t('发送 Webhook 测试')"
            :icon="testingWebhook ? 'pi pi-spinner pi-spin' : 'pi pi-bolt'"
            :disabled="testingWebhook || !config.afdian.enabled"
            variant="secondary"
            size="small"
            @click="handleTestWebhook"
          />
          <p v-if="testResult" class="mt-2 text-xs" :class="testResult.success ? 'text-green-600' : 'text-red-600'">
            {{ testResult.message }}
          </p>
        </div>
      </Card>

      <!-- 微信好友支付配置 -->
      <Card class="p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-primary-800 dark:text-primary-50 flex items-center gap-2">
            <i class="pi pi-wechat" /> {{ t('微信好友支付 (WECHAT)') }}
          </h2>
          <ToggleSwitch :modelValue="config.wechat.enabled" @update:model-value="(v: boolean) => config.wechat.enabled = v" />
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('微信号') }}</label>
            <Input v-model="config.wechat.accountId" :placeholder="t('用于展示给用户的站长微信号')" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('微信昵称(可选)') }}</label>
            <Input v-model="config.wechat.accountName" :placeholder="t('展示用的昵称，方便用户识别')" />
          </div>
          <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <i class="pi pi-info-circle mr-1"></i>
            {{ t('选择此支付方式的用户将看到您的微信号和订单信息，需管理员在订单列表中手动确认到账。不受订单过期时间限制。') }}
          </div>
        </div>
      </Card>

      <!-- 通用配置 -->
      <Card class="p-6 mb-6">
        <h2 class="text-lg font-semibold text-primary-800 dark:text-primary-50 mb-4">{{ t('通用设置') }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('订单过期时间(分钟)') }}
            </label>
            <InputNumber v-model="config.orderExpireMinutes" :min="5" :max="1440" class="w-40" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('默认30分钟，超时未支付自动取消') }}</p>
          </div>
        </div>
      </Card>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <Button
          :label="saving ? t('保存中...') : t('保存配置')"
          :icon="saving ? 'pi pi-spinner pi-spin' : 'pi pi-check'"
          variant="primary"
          :disabled="saving"
          @click="handleSave"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useAPI } from '@/api';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { Card, Button, Input, Password, InputNumber, ToggleSwitch, ProgressSpinner } from '@/components/base';

const toast = useToast();
const { t } = useI18n();
const { API } = useAPI();

/** 是否正在加载 */
const loading = ref(true);
/** 是否正在保存 */
const saving = ref(false);
/** 是否正在测试 Webhook */
const testingWebhook = ref(false);
/** 测试结果 */
const testResult = ref<{ success: boolean; message: string } | null>(null);

/** 配置数据 */
const config = reactive({
  mbd: {
    enabled: false,
    appId: '',
    appKey: '',
  },
  afdian: {
    enabled: false,
    userId: '',
    apiKey: '',
  },
  wechat: {
    enabled: false,
    accountId: '',
    accountName: '',
  },
  orderExpireMinutes: 30,
});

/** 加载配置 */
async function loadConfig() {
  loading.value = true;
  try {
    const data = await API.paymentApi.getPaymentConfig();
    if (data?.mbd) Object.assign(config.mbd, data.mbd);
    if (data?.afdian) Object.assign(config.afdian, data.afdian);
    if (data?.wechat) Object.assign(config.wechat, data.wechat);
    if (data?.orderExpireMinutes) config.orderExpireMinutes = data.orderExpireMinutes;
  } catch (e) {
    console.error('[PaymentConfig] 加载配置失败:', e);
  } finally {
    loading.value = false;
  }
}

/** 保存配置 */
async function handleSave() {
  saving.value = true;
  try {
    await API.paymentApi.savePaymentConfig({
      mbd: { ...config.mbd },
      afdian: { ...config.afdian },
      wechat: { ...config.wechat },
      orderExpireMinutes: config.orderExpireMinutes,
    });
    toast.success(t('支付配置已保存'));
  } catch (e) {
    console.error('[PaymentConfig] 保存失败:', e);
    toast.error(t('保存失败'));
  } finally {
    saving.value = false;
  }
}

/** 测试 Webhook 连通性 */
async function handleTestWebhook() {
  testingWebhook.value = true;
  testResult.value = null;

  try {
    const result = await API.paymentApi.testAfdianWebhook();
    testResult.value = {
      success: result?.result?.success ?? true,
      message: result?.result?.success
        ? t('Webhook 测试通过！解析逻辑正常（注意：这是本地模拟数据，未连接爱发电服务器）')
        : t('Webhook 测试完成，订单号不匹配（正常现象：测试数据无对应订单）'),
    };
  } catch (e) {
    console.error('[PaymentConfig] Webhook 测试失败:', e);
    testResult.value = { success: false, message: String(e) };
  } finally {
    testingWebhook.value = false;
  }
}

onMounted(() => {
  loadConfig();
});
</script>
