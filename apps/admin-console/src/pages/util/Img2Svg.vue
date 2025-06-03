<template>
  <div class="svg-generator p-4 max-w-4xl mx-auto">
    <div class="grid gap-4 mb-4">
      <FileUpload
        mode="basic"
        accept="image/*"
        chooseLabel="选择图片"
        @select="handleImageUpload" />
      <div class="flex flex-col">
        <label class="text-sm mb-1">检测模式</label>
        <Dropdown v-model="detectionMode" :options="['二值化', '透明度']" />
      </div>
      <div class="flex flex-col" v-if="detectionMode === '二值化'">
        <label class="text-sm mb-1">二值化阈值</label>
        {{ binarizeThreshold }}
        <Slider v-model="binarizeThreshold" :min="10" :max="150" />
      </div>
      <div class="flex flex-col" v-if="detectionMode === '透明度'">
        <label class="text-sm mb-1">透明度阈值</label>
        {{ alphaThreshold }}
        <Slider v-model="alphaThreshold" :min="0" :max="255" />
      </div>
      <div class="flex flex-col">
        <label class="text-sm mb-1">反相处理</label>
        <InputSwitch v-model="invertColors" />
      </div>
    </div>

    <ProgressBar v-if="loading" mode="indeterminate" />
    <div v-if="previewData" class="preview-container p-4 border border-gray-200 rounded">
      <img :src="previewData" alt="预览" />
      <button @click="generateSVG" class="mt-2 p-2 bg-blue-500 text-white rounded">
        生成SVG描边
      </button>
    </div>
    <div v-if="svgPreview" class="mt-4 p-4 border border-gray-200 rounded">
      <div v-html="svgPreview"></div>
    </div>
    <canvas ref="canvas" style="display: none"></canvas>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import FileUpload from 'primevue/fileupload';
  import ProgressBar from 'primevue/progressbar';
  import Dropdown from 'primevue/dropdown';

  const canvas = ref<HTMLCanvasElement | null>(null);
  const previewData = ref<string | null>(null);
  const loading = ref(false);
  const binarizeThreshold = ref(30);
  const alphaThreshold = ref(128);
  const detectionMode = ref<'二值化' | '透明度'>('二值化');
  const originImgUrl = ref<string>();

  const invertColors = ref(false);

  watch([binarizeThreshold, alphaThreshold, detectionMode, invertColors], () => {
    if (originImgUrl.value) {
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = originImgUrl.value;
    }
  });

  const handleImageUpload = (event: { files: File[] }) => {
    if (!event.files.length) return;

    loading.value = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        processImage(img);
        loading.value = false;
      };
      img.src = e.target?.result as string;
      originImgUrl.value = img.src;
    };
    reader.readAsDataURL(event.files[0]);
  };

  const processImage = (img: HTMLImageElement) => {
    if (!canvas.value) return;

    const ctx = canvas.value.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.value.width = img.width;
    canvas.value.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    if (detectionMode.value === '二值化') {
      binarizeImage(imageData);
    } else {
      alphaDetectImage(imageData);
    }

    if (invertColors.value) {
      invertImage(imageData);
    }

    previewData.value = canvas.value.toDataURL();
  };

  /** 反相处理图像 */
  const invertImage = (imageData: ImageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    if (canvas.value) {
      const ctx = canvas.value.getContext('2d');
      ctx?.putImageData(imageData, 0, 0);
    }
  };

  const binarizeImage = (imageData: ImageData) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const value = avg > binarizeThreshold.value ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }

    if (canvas.value) {
      const ctx = canvas.value.getContext('2d');
      ctx?.putImageData(imageData, 0, 0);
    }
  };

  const alphaDetectImage = (imageData: ImageData) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      const value = alpha > alphaThreshold.value ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }

    if (canvas.value) {
      const ctx = canvas.value.getContext('2d');
      ctx?.putImageData(imageData, 0, 0);
    }
  };
  const svgPreview = ref<string | null>(null);
  const generateSVG = () => {
    if (!canvas.value) return;

    const ctx = canvas.value.getContext('2d');
    if (!ctx) return;

    const width = canvas.value.width;
    const height = canvas.value.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const paths = traceImageToSVG(imageData);

    svgPreview.value = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="${paths.join(' ')}" fill="#000000" stroke="none"/>
    </svg>
  `;
  };

const traceImageToSVG = (imageData: ImageData): string[] => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const paths: string[] = [];

  /** 检查像素是否为黑色 */
  const isBlack = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const index = (y * width + x) * 4;
    return data[index] === 0 && data[index + 3] > 0;
  };

  /** 生成实心路径 - 优化版 */
  for (let y = 0; y < height; y++) {
    let inPath = false;
    let startX = 0;

    for (let x = 0; x < width; x++) {
      if (isBlack(x, y)) {
        if (!inPath) {
          inPath = true;
          startX = x;
        }
      } else if (inPath) {
        inPath = false;
        paths.push(`M${startX} ${y}h${x - startX}v1h-${x - startX}z`);
      }
    }

    if (inPath) {
      paths.push(`M${startX} ${y}h${width - startX}v1h-${width - startX}z`);
    }
  }

  return paths;
};
</script>

<style scoped>
  .preview-container {
    max-width: 100%;
    overflow: auto;
  }
</style>
