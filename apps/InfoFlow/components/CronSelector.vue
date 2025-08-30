<template>
  <div class="cron-selector w-full">
    <div class="mb-3">
      <label class="block text-sm font-medium mb-2">Cron 表达式 *</label>
      <InputText
        v-model="cronExpression"
        placeholder="0 9 * * *"
        :class="{ 'p-invalid': error }"
        class="w-full"
        @input="onCronInput" />
      <small v-if="error" class="text-red-500">{{ error }}</small>
      <small class="text-gray-500">格式: 分钟 小时 * * * (例如: 0 9 * * * = 每天9点)</small>
    </div>

    <!-- 滑块选择器 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">快速设置</label>
      <div class="relative">
        <!-- 滑块分段背景 -->
        <div class="absolute top-0 left-0 w-full h-2 flex pointer-events-none rounded-lg overflow-hidden">
          <div class="w-1/4 bg-blue-200"></div>
          <div class="w-1/4 bg-green-200"></div>
          <div class="w-1/4 bg-yellow-200"></div>
          <div class="w-1/4 bg-purple-200"></div>
        </div>

        <input
          ref="slider"
          v-model="sliderValue"
          type="range"
          min="0"
          max="1000"
          step="1"
          class="relative w-full h-2 bg-transparent appearance-none cursor-pointer slider z-10"
          @input="onSliderInput" />

        <!-- 滑块分段标记 -->
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>分钟</span>
          <span>小时</span>
          <span>天</span>
          <span>星期</span>
        </div>
      </div>
    </div>

    <!-- 当前频率设置 -->
    <div v-if="currentFrequency" class="mb-4 p-3 bg-gray-50 rounded-lg">
      <div class="text-sm font-medium text-gray-700 mb-2">当前设置:</div>
      <div class="text-sm text-gray-600">{{ currentFrequency.description }}</div>
      <div class="text-xs text-gray-500 mt-1">Cron: {{ currentFrequency.cron }}</div>
    </div>

    <!-- 详细设置面板 -->
    <div class="space-y-3">
      <!-- 分钟设置 -->
      <div v-show="currentMode === 'minute'" class="p-3 bg-blue-50 rounded-lg">
        <label class="block text-sm font-medium mb-2">每多少分钟执行一次</label>
        <div class="flex items-center gap-3">
          <InputNumber
            v-model="minuteValue"
            :min="1"
            :max="59"
            class="w-24"
            @input="updateFromMinute" />
          <span class="text-sm text-gray-600">分钟</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">范围: 1-59 分钟</div>
      </div>

      <!-- 小时设置 -->
      <div v-show="currentMode === 'hour'" class="p-3 bg-green-50 rounded-lg">
        <label class="block text-sm font-medium mb-2">每多少小时执行一次</label>
        <div class="flex items-center gap-3">
          <InputNumber
            v-model="hourValue"
            :min="1"
            :max="23"
            class="w-24"
            @input="updateFromHour" />
          <span class="text-sm text-gray-600">小时</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">范围: 1-23 小时</div>
      </div>

      <!-- 天设置 -->
      <div v-show="currentMode === 'day'" class="p-3 bg-yellow-50 rounded-lg">
        <label class="block text-sm font-medium mb-2">每多少天执行一次</label>
        <div class="flex items-center gap-3">
          <InputNumber
            v-model="dayValue"
            :min="1"
            :max="30"
            class="w-24"
            @input="updateFromDay" />
          <span class="text-sm text-gray-600">天</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">范围: 1-30 天</div>
      </div>

      <!-- 星期设置 -->
      <div v-show="currentMode === 'week'" class="p-3 bg-purple-50 rounded-lg">
        <label class="block text-sm font-medium mb-2">每多少星期执行一次</label>
        <div class="flex items-center gap-3">
          <InputNumber
            v-model="weekValue"
            :min="1"
            :max="4"
            class="w-24"
            @input="updateFromWeek" />
          <span class="text-sm text-gray-600">星期</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">范围: 1-4 星期</div>
        <div class="mt-2">
          <label class="block text-sm font-medium mb-1">选择星期几</label>
          <Select
            v-model="weekDay"
            :options="weekDayOptions"
            optionLabel="label"
            optionValue="value"
            class="w-32"
            @change="updateFromWeek" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';

interface Props {
  modelValue?: string;
  error?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '0 9 * * *',
  error: '',
});

const emit = defineEmits<Emits>();

// 响应式数据
const cronExpression = ref(props.modelValue);
const sliderValue = ref(0);
const currentMode = ref<'minute' | 'hour' | 'day' | 'week'>('minute');

// 频率设置值
const minuteValue = ref(5);
const hourValue = ref(1);
const dayValue = ref(1);
const weekValue = ref(1);
const weekDay = ref(1); // 1-7 对应周一到周日

const slider = ref<HTMLInputElement>();

// 星期选项
const weekDayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

// 当前频率信息
const currentFrequency = computed(() => {
  switch (currentMode.value) {
    case 'minute':
      return {
        description: `每 ${minuteValue.value} 分钟执行一次`,
        cron: `*/${minuteValue.value} * * * *`,
      };
    case 'hour':
      return {
        description: `每 ${hourValue.value} 小时执行一次`,
        cron: `0 */${hourValue.value} * * *`,
      };
    case 'day':
      return {
        description: `每 ${dayValue.value} 天执行一次`,
        cron: `0 9 */${dayValue.value} * *`,
      };
    case 'week':
      const dayName = weekDayOptions.find(opt => opt.value === weekDay.value)?.label || '周一';
      return {
        description: `每 ${weekValue.value} 星期执行一次（${dayName}）`,
        cron: `0 9 * * ${weekDay.value}`,
      };
    default:
      return null;
  }
});

// 解析 cron 表达式
const parseCron = (cron: string) => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, day, month, weekday] = parts;

  // 解析分钟频率
  if (minute.includes('*/')) {
    const interval = parseInt(minute.replace('*/', ''));
    if (interval >= 1 && interval <= 59) {
      currentMode.value = 'minute';
      minuteValue.value = interval;
      // 将分钟值映射到滑块位置 (1-59 -> 0-250)
      const minuteRange = 59 - 1; // 58
      const minuteStep = minuteRange / 250; // 每个滑块单位对应的分钟数
      sliderValue.value = (interval - 1) / minuteStep;
      return;
    }
  }

  // 解析小时频率
  if (minute === '0' && hour.includes('*/')) {
    const interval = parseInt(hour.replace('*/', ''));
    if (interval >= 1 && interval <= 23) {
      currentMode.value = 'hour';
      hourValue.value = interval;
      // 将小时值映射到滑块位置 (1-23 -> 250-500)
      const hourRange = 23 - 1; // 22
      const hourStep = hourRange / 250; // 每个滑块单位对应的小时数
      sliderValue.value = 250 + (interval - 1) / hourStep;
      return;
    }
  }

  // 解析天频率
  if (minute === '0' && hour === '9' && day.includes('*/')) {
    const interval = parseInt(day.replace('*/', ''));
    if (interval >= 1 && interval <= 30) {
      currentMode.value = 'day';
      dayValue.value = interval;
      // 将天数值映射到滑块位置 (1-30 -> 500-750)
      const dayRange = 30 - 1; // 29
      const dayStep = dayRange / 250; // 每个滑块单位对应的天数
      sliderValue.value = 500 + (interval - 1) / dayStep;
      return;
    }
  }

  // 解析星期频率
  if (minute === '0' && hour === '9' && day === '*' && month === '*' && weekday !== '*') {
    const dayNum = parseInt(weekday);
    if (dayNum >= 1 && dayNum <= 7) {
      currentMode.value = 'week';
      weekDay.value = dayNum;
      weekValue.value = 1;
      // 将星期值映射到滑块位置 (1-4 -> 750-1000)
      const weekRange = 4 - 1; // 3
      const weekStep = weekRange / 250; // 每个滑块单位对应的星期数
      sliderValue.value = 750 + (1 - 1) / weekStep;
      return;
    }
  }

  // 如果解析失败，尝试解析固定时间
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
    // 固定时间执行，设置为天模式
    currentMode.value = 'day';
    dayValue.value = 1;
    sliderValue.value = 500 + (1 - 1) / ((30 - 1) / 250);
    return;
  }

  // 默认设置为天模式
  currentMode.value = 'day';
  dayValue.value = 1;
  sliderValue.value = 500 + (1 - 1) / ((30 - 1) / 250);
};

// 更新 cron 表达式
const updateCron = () => {
  if (currentFrequency.value) {
    cronExpression.value = currentFrequency.value.cron;
    emit('update:modelValue', cronExpression.value);
  }
};

// 滑块输入处理
const onSliderInput = () => {
  const value = sliderValue.value;

  if (value <= 250) {
    // 分钟模式: 1-59分钟，映射到滑块值 0-250
    currentMode.value = 'minute';
    const minuteRange = 59 - 1; // 58
    const minuteStep = minuteRange / 250; // 每个滑块单位对应的分钟数
    minuteValue.value = Math.round(1 + value * minuteStep);
  } else if (value <= 500) {
    // 小时模式: 1-23小时，映射到滑块值 250-500
    currentMode.value = 'hour';
    const hourRange = 23 - 1; // 22
    const hourStep = hourRange / 250; // 每个滑块单位对应的小时数
    hourValue.value = Math.round(1 + (value - 250) * hourStep);
  } else if (value <= 750) {
    // 天模式: 1-30天，映射到滑块值 500-750
    currentMode.value = 'day';
    const dayRange = 30 - 1; // 29
    const dayStep = dayRange / 250; // 每个滑块单位对应的天数
    dayValue.value = Math.round(1 + (value - 500) * dayStep);
  } else {
    // 星期模式: 1-4星期，映射到滑块值 750-1000
    currentMode.value = 'week';
    const weekRange = 4 - 1; // 3
    const weekStep = weekRange / 250; // 每个滑块单位对应的星期数
    weekValue.value = Math.round(1 + (value - 750) * weekStep);
  }

  updateCron();
};

// Cron 输入处理
const onCronInput = () => {
  emit('update:modelValue', cronExpression.value);
  parseCron(cronExpression.value);
};

// 从分钟设置更新
const updateFromMinute = () => {
  currentMode.value = 'minute';
  // 将分钟值映射回滑块位置 (1-59 -> 0-250)
  const minuteRange = 59 - 1; // 58
  const minuteStep = minuteRange / 250; // 每个滑块单位对应的分钟数
  sliderValue.value = (minuteValue.value - 1) / minuteStep;
  updateCron();
};

// 从小时设置更新
const updateFromHour = () => {
  currentMode.value = 'hour';
  // 将小时值映射回滑块位置 (1-23 -> 250-500)
  const hourRange = 23 - 1; // 22
  const hourStep = hourRange / 250; // 每个滑块单位对应的小时数
  sliderValue.value = 250 + (hourValue.value - 1) / hourStep;
  updateCron();
};

// 从天设置更新
const updateFromDay = () => {
  currentMode.value = 'day';
  // 将天数值映射回滑块位置 (1-30 -> 500-750)
  const dayRange = 30 - 1; // 29
  const dayStep = dayRange / 250; // 每个滑块单位对应的天数
  sliderValue.value = 500 + (dayValue.value - 1) / dayStep;
  updateCron();
};

// 从星期设置更新
const updateFromWeek = () => {
  currentMode.value = 'week';
  // 将星期值映射回滑块位置 (1-4 -> 750-1000)
  const weekRange = 4 - 1; // 3
  const weekStep = weekRange / 250; // 每个滑块单位对应的星期数
  sliderValue.value = 750 + (weekValue.value - 1) / weekStep;
  updateCron();
};

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== cronExpression.value) {
    cronExpression.value = newValue;
    parseCron(newValue);
  }
});

// 初始化
onMounted(() => {
  parseCron(props.modelValue);
});
</script>

<style scoped>
.cron-selector {
  /* 自定义滑块样式 */
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin-top: -10px;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin-top: -6px;
}

/* 滑块轨道样式 */
.slider::-webkit-slider-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
  margin: 0;
  padding: 0;
}

.slider::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
  margin: 0;
  padding: 0;
}
</style>