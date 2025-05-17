<template>
  <div class="w-full h-screen relative">
    <!-- 控制按钮 -->
    <div class="absolute top-5 right-5 z-30 flex gap-2">
      <button class="control-btn" @click="toggleInfo" title="显示场景信息">i</button>
      <button class="control-btn" @click="zoomIn" title="放大">+</button>
      <button class="control-btn" @click="zoomOut" title="缩小">-</button>
      <button class="control-btn" @click="resetView" title="重置视角">↻</button>
      <button class="control-btn" @click="toggleDebug" title="调试模式">D</button>
      <button class="control-btn" @click="saveScenes" title="保存场景数据">💾</button>
      <button class="control-btn" @click="resetScenes" title="重置场景数据">🔄</button>
    </div>

    <!-- 小地图 -->
    <div class="absolute top-5 right-20 z-30 transition-all duration-300">
      <button class="control-btn" @click="toggleMinimap" title="显示/隐藏小地图">
        {{ isMinimapCollapsed ? 'M' : '×' }}
      </button>
      <div class="minimap-container" :class="{ hidden: isMinimapCollapsed }" ref="minimap">
        <div class="flex justify-between items-center mb-2 pb-1 border-b border-white/20">
          <h3 class="font-bold text-sm m-0">场景地图</h3>
        </div>
        <div class="flex-1 relative bg-black/30 rounded overflow-hidden">
          <canvas class="w-full h-full" ref="minimapCanvas" @click="handleMinimapClick"></canvas>
        </div>
        <div class="mt-2 text-xs">
          <div class="flex items-center mb-1">
            <div class="w-3 h-3 rounded-full bg-hotspot-primary mr-1"></div>
            <span>当前位置</span>
          </div>
          <div class="flex items-center mb-1">
            <div class="w-3 h-3 rounded-full bg-hotspot-secondary mr-1"></div>
            <span>可前往位置</span>
          </div>
          <div class="flex items-center mb-1">
            <div class="w-3 h-3 rounded-full bg-gray-500 mr-1"></div>
            <span>其他场景</span>
          </div>
          <div class="flex items-center">
            <div class="minimap-direction-arrow" ref="directionArrow"></div>
            <span>当前方向</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 信息面板 -->
    <div class="info-panel" :class="{ hidden: !showInfo }">
      <h3 class="mt-0 mb-2 font-bold">
        {{ currentSceneData ? currentSceneData.title : '加载中...' }}
      </h3>
      <p class="m-0">
        当前场景: <span>{{ currentSceneData ? currentSceneData.title : '加载中...' }}</span>
      </p>
      <p class="mt-2 mb-1">可前往场景:</p>
      <ul class="pl-5 mt-1">
        <li v-for="hotspot in currentHotspots" :key="hotspot.id">
          {{ hotspot.title }}
        </li>
      </ul>
    </div>

    <!-- 调试面板 -->
    <div class="debug-panel" :class="{ hidden: !debugMode }">
      <h4 class="font-bold mb-1">调试信息</h4>
      <div v-html="debugInfo"></div>
    </div>

    <!-- 点击反馈 -->
    <div class="feedback-message" :style="{ opacity: feedbackOpacity }" ref="hotspotFeedback">
      {{ feedbackMessage }}
    </div>

    <!-- 视角中心点 -->
    <div class="view-direction" :class="{ hidden: !debugMode }" ref="viewDirection"></div>

    <!-- 过渡效果元素 -->
    <div class="transition-overlay" ref="transitionOverlay"></div>
    <div class="zoom-effect" ref="zoomEffect"></div>
    <div class="direction-indicator" ref="directionIndicator"></div>

    <!-- 保存/重置提示 -->
    <div
      class="fixed top-5 left-1/2 transform -translate-x-1/2 bg-black/70 text-white py-2 px-4 rounded-lg z-50 transition-opacity duration-300"
      :style="{ opacity: notificationOpacity }">
      {{ notificationMessage }}
    </div>

    <!-- A-Frame 场景 -->
    <div ref="aframeContainer" class="w-full h-full"></div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
  import Aframe, { THREE } from 'aframe';

  // 类型定义
  interface Position {
    x: number;
    y: number;
  }

  interface Scene {
    id: string;
    title: string;
    imageUrl: string;
    position: Position;
    connections: string[];
  }

  interface Hotspot {
    id: string;
    targetScene: string;
    title: string;
    color: string;
    direction: {
      x: number;
      y: number;
      z: number;
    };
  }

  // 默认场景数据
  const DEFAULT_SCENES: Scene[] = [
    {
      id: 'office',
      title: '办公室',
      imageUrl:
        'https://image.pollinations.ai/prompt/360arimg?width=2048&height=1024&nologo=true&model=flux',
      position: { x: 0, y: 0 },
      connections: ['palace', 'garden', 'library'],
    },
    {
      id: 'palace',
      title: '故宫',
      imageUrl:
        'https://image.pollinations.ai/prompt/360arImg_%E6%95%85%E5%AE%AB%E5%8A%9E%E5%85%AC%E5%AE%A4?width=2048&height=1024&nologo=true&model=flux',
      position: { x: 0, y: -60 }, // 北方
      connections: ['office', 'garden'],
    },
    {
      id: 'garden',
      title: '花园',
      imageUrl:
        'https://image.pollinations.ai/prompt/360arImg_%E4%B8%AD%E5%9B%BD%E5%8F%A4%E5%85%B8%E8%8A%B1%E5%9B%AD?width=2048&height=1024&nologo=true&model=flux',
      position: { x: -60, y: 0 }, // 西方
      connections: ['office', 'palace'],
    },
    {
      id: 'library',
      title: '图书馆',
      imageUrl:
        'https://image.pollinations.ai/prompt/360arImg_%E5%8F%A4%E4%BB%A3%E5%9B%BE%E4%B9%A6%E9%A6%86?width=2048&height=1024&nologo=true&model=flux',
      position: { x: 0, y: 60 }, // 南方
      connections: ['office'],
    },
  ];

  // 热点颜色映射
  const hotspotColors: Record<string, string> = {
    palace: '#4A90E2', // 蓝色
    garden: '#50E3C2', // 绿色
    library: '#F5A623', // 橙色
    office: '#FF5733', // 红色
  };

  // 状态
  const scenes = ref<Scene[]>([...DEFAULT_SCENES]); // 初始化为默认场景的副本
  const currentScene = ref<string>('office');
  const isTransitioning = ref<boolean>(false);
  const zoom = ref<number>(1);
  const debugMode = ref<boolean>(false);
  const isMinimapCollapsed = ref<boolean>(false);
  const minimapScale = ref<number>(1);
  const showInfo = ref<boolean>(false);
  const debugInfo = ref<string>('等待交互...');
  const feedbackMessage = ref<string>('');
  const feedbackOpacity = ref<number>(0);
  const notificationMessage = ref<string>('');
  const notificationOpacity = ref<number>(0);
  const isInitialized = ref<boolean>(false);
  const rotationListener = ref<any>(null);

  // 引用DOM元素
  const aframeContainer = ref<HTMLElement | null>(null);
  const minimap = ref<HTMLElement | null>(null);
  const minimapCanvas = ref<HTMLCanvasElement | null>(null);
  const directionArrow = ref<HTMLElement | null>(null);
  const viewDirection = ref<HTMLElement | null>(null);
  const hotspotFeedback = ref<HTMLElement | null>(null);
  const transitionOverlay = ref<HTMLElement | null>(null);
  const zoomEffect = ref<HTMLElement | null>(null);
  const directionIndicator = ref<HTMLElement | null>(null);

  // 从localStorage加载场景数据
  const loadScenes = () => {
    try {
      const savedScenes = localStorage.getItem('panorama-scenes');
      const savedCurrentScene = localStorage.getItem('panorama-current-scene');

      if (savedScenes) {
        const parsedScenes = JSON.parse(savedScenes);

        // 验证场景数据
        if (!Array.isArray(parsedScenes) || parsedScenes.length === 0) {
          throw new Error('场景数据格式无效');
        }

        scenes.value = parsedScenes;
        logDebug('从localStorage加载场景数据成功');

        // 设置当前场景
        if (savedCurrentScene && scenes.value.some((s) => s.id === savedCurrentScene)) {
          currentScene.value = savedCurrentScene;
        } else {
          currentScene.value = scenes.value[0].id;
        }
      } else {
        // 使用默认场景数据
        scenes.value = [...DEFAULT_SCENES];
        currentScene.value = 'office';
        logDebug('使用默认场景数据');
      }
    } catch (error) {
      console.error('加载场景数据失败:', error);
      scenes.value = [...DEFAULT_SCENES];
      currentScene.value = 'office';
      logDebug('加载场景数据失败，使用默认场景数据');
    }
  };

  // 保存场景数据到localStorage
  const saveScenes = () => {
    try {
      localStorage.setItem('panorama-scenes', JSON.stringify(scenes.value));
      localStorage.setItem('panorama-current-scene', currentScene.value);
      showNotification('场景数据已保存');
      logDebug('场景数据已保存到localStorage');
    } catch (error: any) {
      console.error('保存场景数据失败:', error);
      showNotification('保存场景数据失败');
      logDebug('保存场景数据失败: ' + error.message);
    }
  };

  // 重置场景数据
  const resetScenes = () => {
    scenes.value = [...DEFAULT_SCENES];
    currentScene.value = 'office';
    showNotification('场景数据已重置');
    logDebug('场景数据已重置为默认值');

    // 更新场景
    updateHotspots();
  };

  // 显示通知
  const showNotification = (message: string) => {
    notificationMessage.value = message;
    notificationOpacity.value = 1;
    setTimeout(() => {
      notificationOpacity.value = 0;
    }, 2000);
  };

  // 计算属性
  const currentSceneData = computed(() => {
    if (!scenes.value || scenes.value.length === 0) return null;
    return scenes.value.find((scene) => scene.id === currentScene.value) || scenes.value[0];
  });

  // 计算当前场景的热点数据
  const currentHotspots = computed(() => {
    const scene = currentSceneData.value;
    if (!scene || !scene.connections) return [];

    return scene.connections
      .map((targetId) => {
        const targetScene = scenes.value.find((s) => s.id === targetId);
        if (!targetScene) return null;

        // 计算从当前场景到目标场景的方向向量
        const direction = calculateDirection(scene.position, targetScene.position);

        return {
          id: `to-${targetId}`,
          targetScene: targetId,
          title: `前往${targetScene.title}`,
          color: hotspotColors[targetId] || '#4A90E2',
          direction: direction,
        };
      })
      .filter(Boolean) as Hotspot[];
  });

  // 计算两点之间的方向向量 (2D坐标转换为3D方向)
  const calculateDirection = (from: Position, to: Position) => {
    if (!from || !to) return { x: 0, y: 0, z: 0 };

    // 计算2D方向向量
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 将2D坐标转换为3D方向向量
    return { x: dx, y: 0, z: dy };
  };

  // 计算方向向量的角度（相对于z轴负方向）
  const directionToAngle = (direction: { x: number; y: number; z: number }) => {
    if (!direction) return 0;
    return Math.atan2(-direction.x, -direction.z) * (180 / Math.PI);
  };

  // 记录调试信息
  const logDebug = (message: string) => {
    console.log(message);
    if (debugMode.value) {
      const timestamp = new Date().toLocaleTimeString();
      debugInfo.value = `[${timestamp}] ${message}<br>` + debugInfo.value;

      // 限制调试信息数量
      const lines = debugInfo.value.split('<br>');
      if (lines.length > 10) {
        debugInfo.value = lines.slice(0, 10).join('<br>');
      }
    }
  };

  // 显示点击反馈
  const showFeedback = (message: string) => {
    feedbackMessage.value = message;
    feedbackOpacity.value = 1;
    setTimeout(() => {
      feedbackOpacity.value = 0;
    }, 1500);
  };

  // UI控制方法
  const toggleInfo = () => {
    showInfo.value = !showInfo.value;
  };
  const toggleDebug = () => {
    debugMode.value = !debugMode.value;
    updateViewDirection();
    logDebug('调试模式: ' + (debugMode.value ? '开启' : '关闭'));
  };
  const toggleMinimap = () => {
    isMinimapCollapsed.value = !isMinimapCollapsed.value;
    if (!isMinimapCollapsed.value) setTimeout(drawMinimap, 300);
  };
  const zoomIn = () => {
    if (zoom.value < 2) {
      zoom.value += 0.1;
      logDebug(`放大: ${zoom.value.toFixed(1)}`);
      updateCameraZoom();
    }
  };
  const zoomOut = () => {
    if (zoom.value > 0.5) {
      zoom.value -= 0.1;
      logDebug(`缩小: ${zoom.value.toFixed(1)}`);
      updateCameraZoom();
    }
  };
  const resetView = () => {
    const camera = document.getElementById('camera');
    if (camera) {
      camera.setAttribute('rotation', '0 0 0');
      zoom.value = 1;
      updateCameraZoom();
      logDebug('重置视角');
    }
  };

  // 更新相机缩放
  const updateCameraZoom = () => {
    const camera = document.getElementById('camera');
    if (camera) {
      camera.setAttribute('zoom', zoom.value.toString());
    }
  };

  // 注册A-Frame组件
  const registerAFrameComponents = () => {
    // 热点组件
    AFRAME.registerComponent('hotspot', {
      schema: {
        target: { type: 'string' },
        title: { type: 'string' },
        color: { type: 'string', default: '#4A90E2' },
      },

      init: function () {
        const el = this.el;
        const data = this.data;

        el.classList.add('clickable');

        el.addEventListener('click', function (evt) {
          document.dispatchEvent(
            new CustomEvent('hotspot-click', {
              detail: { target: data.target, title: data.title, element: el },
            }),
          );
          evt.stopPropagation();
          evt.preventDefault();
        });

        el.addEventListener('mouseenter', () => el.setAttribute('scale', '1.2 1.2 1.2'));
        el.addEventListener('mouseleave', () => el.setAttribute('scale', '1 1 1'));
      },
    });

    // 旋转动画组件
    AFRAME.registerComponent('rotate-animation', {
      schema: { speed: { type: 'number', default: 5 } },
      tick: function (time: number, deltaTime: number) {
        const rotation = this.el.getAttribute('rotation');
        this.el.setAttribute('rotation', {
          x: rotation.x,
          y: rotation.y + (deltaTime / 1000) * this.data.speed * 60,
          z: rotation.z,
        });
      },
    });
  };

  // 创建A-Frame场景
  const createAFrameScene = () => {
    if (!aframeContainer.value) return;

    // 创建A-Frame场景
    const scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('vr-mode-ui', 'enabled: false');

    // 创建资源
    const assets = document.createElement('a-assets');
    scenes.value.forEach((scene) => {
      const img = document.createElement('img');
      img.id = `panorama-${scene.id}`;
      img.src = scene.imageUrl;
      img.setAttribute('crossorigin', 'anonymous');
      assets.appendChild(img);
    });
    scene.appendChild(assets);

    // 创建天空球
    const sky = document.createElement('a-sky');
    sky.id = 'sky';
    sky.setAttribute('src', `#panorama-${currentScene.value}`);
    sky.setAttribute('rotation', '0 -90 0');
    sky.setAttribute('radius', '9.9');
    sky.setAttribute('segments-height', '72');
    sky.setAttribute('segments-width', '72');
    scene.appendChild(sky);

    // 创建相机和光标
    const cameraRig = document.createElement('a-entity');
    cameraRig.id = 'camera-rig';
    cameraRig.setAttribute('position', '0 0 0');

    const camera = document.createElement('a-camera');
    camera.id = 'camera';
    camera.setAttribute('look-controls', 'reverseMouseDrag: true');
    camera.setAttribute('wasd-controls', 'enabled: false');
    camera.setAttribute('zoom', zoom.value.toString());

    const cursor = document.createElement('a-entity');
    cursor.id = 'cursor';
    cursor.setAttribute('cursor', 'fuse: false; rayOrigin: mouse;');
    cursor.setAttribute('position', '0 0 -1');
    cursor.setAttribute('geometry', 'primitive: ring; radiusInner: 0.02; radiusOuter: 0.03');
    cursor.setAttribute('material', 'color: white; shader: flat');
    cursor.setAttribute('raycaster', 'objects: .clickable; far: 100');
    cursor.setAttribute(
      'animation__click',
      'property: scale; startEvents: click; easing: easeInCubic; dur: 150; from: 0.1 0.1 0.1; to: 1 1 1',
    );
    cursor.setAttribute(
      'animation__fusing',
      'property: scale; startEvents: fusing; easing: easeInCubic; dur: 150; from: 1 1 1; to: 0.1 0.1 0.1',
    );
    cursor.setAttribute(
      'animation__mouseleave',
      'property: scale; startEvents: mouseleave; easing: easeInCubic; dur: 150; to: 1 1 1',
    );

    camera.appendChild(cursor);
    cameraRig.appendChild(camera);
    scene.appendChild(cameraRig);

    // 创建热点容器
    const hotspotsContainer = document.createElement('a-entity');
    hotspotsContainer.id = 'hotspots-container';
    scene.appendChild(hotspotsContainer);

    // 添加到DOM
    aframeContainer.value.appendChild(scene);
  };

  // 更新热点
  const updateHotspots = () => {
    // 确保场景已初始化
    if (!isInitialized.value) return;

    // 清除现有热点
    const hotspotsContainer = document.getElementById('hotspots-container');
    if (!hotspotsContainer) return;

    while (hotspotsContainer.firstChild) {
      hotspotsContainer.removeChild(hotspotsContainer.firstChild);
    }

    // 添加新热点
    currentHotspots.value.forEach((hotspot) => {
      // 计算热点位置和旋转
      const dir = hotspot.direction;

      // 归一化方向向量
      const length = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
      const normalizedDir = {
        x: dir.x / length,
        y: 0,
        z: dir.z / length,
      };

      const distance = 8;
      const position = `${normalizedDir.x * distance} 0 ${normalizedDir.z * distance}`;

      // 计算热点旋转 - 使热点始终面向中心
      const rotationY = directionToAngle(normalizedDir);
      const rotation = `0 ${rotationY} 0`;

      // 创建热点容器
      const hotspotEntity = document.createElement('a-entity');
      hotspotEntity.setAttribute('id', `hotspot-${hotspot.id}`);
      hotspotEntity.setAttribute('position', position);
      hotspotEntity.setAttribute('rotation', rotation);
      hotspotEntity.setAttribute('scale', '1 1 1');
      hotspotEntity.setAttribute(
        'hotspot',
        `target: ${hotspot.targetScene}; title: ${hotspot.title}; color: ${hotspot.color}`,
      );

      // 创建碰撞检测区域
      const hitBox = document.createElement('a-sphere');
      hitBox.setAttribute('radius', '1.2');
      hitBox.setAttribute('opacity', '0');
      hitBox.setAttribute('class', 'clickable');

      // 创建外环
      const outerRing = document.createElement('a-torus');
      outerRing.setAttribute('color', hotspot.color);
      outerRing.setAttribute('radius', '0.8');
      outerRing.setAttribute('radius-tubular', '0.02');
      outerRing.setAttribute('segments-tubular', '32');
      outerRing.setAttribute('rotation', '90 0 0');
      outerRing.setAttribute(
        'material',
        `emissive: ${hotspot.color}; emissiveIntensity: 0.8; shader: flat`,
      );
      outerRing.setAttribute('rotate-animation', 'speed: 10');

      // 创建内环
      const innerRing = document.createElement('a-torus');
      innerRing.setAttribute('color', 'white');
      innerRing.setAttribute('radius', '0.6');
      innerRing.setAttribute('radius-tubular', '0.02');
      innerRing.setAttribute('segments-tubular', '32');
      innerRing.setAttribute('rotation', '90 0 0');
      innerRing.setAttribute('material', 'emissive: white; emissiveIntensity: 0.5; shader: flat');
      innerRing.setAttribute('rotate-animation', 'speed: -7');

      // 创建中心圆盘
      const centerDisk = document.createElement('a-circle');
      centerDisk.setAttribute('color', hotspot.color);
      centerDisk.setAttribute('radius', '0.4');
      centerDisk.setAttribute('rotation', '90 0 0');
      centerDisk.setAttribute(
        'material',
        `opacity: 0.8; transparent: true; emissive: ${hotspot.color}; emissiveIntensity: 0.5; shader: flat`,
      );

      // 创建箭头图标
      const arrowIcon = document.createElement('a-entity');
      arrowIcon.setAttribute('position', '0 0 0.05');
      arrowIcon.setAttribute('rotation', '90 0 0');

      // 箭头三角形
      const arrowTriangle = document.createElement('a-triangle');
      arrowTriangle.setAttribute('color', 'white');
      arrowTriangle.setAttribute('vertex-a', '0 0.25 0');
      arrowTriangle.setAttribute('vertex-b', '-0.2 -0.15 0');
      arrowTriangle.setAttribute('vertex-c', '0.2 -0.15 0');
      arrowTriangle.setAttribute('material', 'shader: flat');

      arrowIcon.appendChild(arrowTriangle);

      // 创建标签
      const text = document.createElement('a-text');
      text.setAttribute('value', hotspot.title);
      text.setAttribute('position', '0 -1.5 0.01');
      text.setAttribute('width', '4');
      text.setAttribute('align', 'center');
      text.setAttribute('color', 'white');
      text.setAttribute('look-at', '[camera]');

      // 组装热点
      [hitBox, outerRing, innerRing, centerDisk, arrowIcon, text].forEach((el) =>
        hotspotEntity.appendChild(el),
      );

      // 添加到场景
      hotspotsContainer.appendChild(hotspotEntity);

      // 调试信息
      if (debugMode.value) {
        logDebug(
          `热点 ${hotspot.title} - 方向: (${normalizedDir.x.toFixed(2)}, ${normalizedDir.z.toFixed(
            2,
          )}), 角度: ${rotationY.toFixed(2)}°`,
        );
      }
    });

    if (currentSceneData.value) {
      logDebug(
        `已更新场景 "${currentSceneData.value.title}" 的热点，共 ${currentHotspots.value.length} 个`,
      );
    }

    // 更新小地图
    if (!isMinimapCollapsed.value) drawMinimap();
  };

  // 切换场景
  const changeScene = (targetSceneId: string, hotspotPosition: THREE.Vector3) => {
    if (isTransitioning.value) return;

    // 获取相机和位置
    const camera = document.getElementById('camera');
    const cameraRig = document.getElementById('camera-rig');
    if (!camera || !cameraRig) return;

    const cameraPosition = new THREE.Vector3();
    camera.object3D.getWorldPosition(cameraPosition);

    // 计算方向
    const direction = new THREE.Vector3().subVectors(hotspotPosition, cameraPosition).normalize();
    const angle = Math.atan2(direction.x, -direction.z) * (180 / Math.PI);

    logDebug(`切换场景到: ${targetSceneId}, 方向角度: ${angle.toFixed(2)}度`);

    isTransitioning.value = true;

    // 设置过渡效果
    if (directionIndicator.value) {
      directionIndicator.value.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      directionIndicator.value.style.opacity = '0.7';
    }

    if (transitionOverlay.value) {
      transitionOverlay.value.style.opacity = '0.7';
    }

    if (zoomEffect.value) {
      zoomEffect.value.style.transform = 'scale(1.5)';
      zoomEffect.value.style.opacity = '0';
    }

    // 计算移动动画
    const currentPosition = cameraRig.getAttribute('position');
    const moveDistance = 5;
    const targetPosition = {
      x: currentPosition.x + direction.x * moveDistance,
      y: currentPosition.y,
      z: currentPosition.z + direction.z * moveDistance,
    };

    // 应用移动动画
    cameraRig.setAttribute('animation', {
      property: 'position',
      to: `${targetPosition.x} ${targetPosition.y} ${targetPosition.z}`,
      dur: 800,
      easing: 'easeInOutQuad',
    });

    // 延迟切换场景
    setTimeout(() => {
      // 更新当前场景
      currentScene.value = targetSceneId;

      // 更新天空球
      const sky = document.getElementById('sky');
      if (sky) {
        sky.setAttribute('src', `#panorama-${targetSceneId}`);
      }

      // 重置相机位置
      cameraRig.removeAttribute('animation');
      cameraRig.setAttribute('position', '0 0 0');

      // 淡入效果
      setTimeout(() => {
        if (transitionOverlay.value) {
          transitionOverlay.value.style.opacity = '0';
        }

        if (directionIndicator.value) {
          directionIndicator.value.style.opacity = '0';
        }

        if (zoomEffect.value) {
          zoomEffect.value.style.transform = 'scale(1)';
          zoomEffect.value.style.opacity = '1';
        }

        isTransitioning.value = false;
      }, 300);
    }, 800);
  };

  // 小地图相关方法
  const drawMinimap = () => {
    if (!minimapCanvas.value || !currentSceneData.value) return;

    const canvas = minimapCanvas.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸和清空
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算小地图缩放比例
    calculateMinimapScale();

    // 绘制小地图
    ctx.save();
    ctx.translate(
      canvas.width / 2 - (currentSceneData.value?.position?.x || 0) * minimapScale.value,
      canvas.height / 2 - (currentSceneData.value?.position?.y || 0) * minimapScale.value,
    );
    ctx.scale(minimapScale.value, minimapScale.value);

    // 绘制连接线和节点
    drawConnections(ctx);
    drawSceneNodes(ctx);
    drawCameraDirection(ctx);

    ctx.restore();
  };

  const calculateMinimapScale = () => {
    if (!scenes.value || scenes.value.length === 0 || !minimapCanvas.value) return;

    // 找出所有场景位置的边界
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    scenes.value.forEach((scene) => {
      if (scene.position) {
        minX = Math.min(minX, scene.position.x);
        minY = Math.min(minY, scene.position.y);
        maxX = Math.max(maxX, scene.position.x);
        maxY = Math.max(maxY, scene.position.y);
      }
    });

    // 计算缩放比例
    const width = maxX - minX + 60;
    const height = maxY - minY + 60;
    const canvas = minimapCanvas.value;
    const scaleX = canvas.offsetWidth / width;
    const scaleY = canvas.offsetHeight / height;

    minimapScale.value = Math.min(scaleX, scaleY, 1);
  };

  const drawConnections = (ctx: CanvasRenderingContext2D) => {
    if (!scenes.value) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;

    scenes.value.forEach((scene) => {
      if (!scene.connections || !scene.position) return;

      scene.connections.forEach((targetId) => {
        const targetScene = scenes.value.find((s) => s.id === targetId);
        if (targetScene && targetScene.position) {
          // 绘制连接线
          ctx.beginPath();
          ctx.moveTo(scene.position.x, scene.position.y);
          ctx.lineTo(targetScene.position.x, targetScene.position.y);
          ctx.stroke();

          // 绘制箭头
          const dx = targetScene.position.x - scene.position.x;
          const dy = targetScene.position.y - scene.position.y;
          const angle = Math.atan2(dy, dx);

          const arrowLength = 10;
          const arrowX = targetScene.position.x - Math.cos(angle) * 15;
          const arrowY = targetScene.position.y - Math.sin(angle) * 15;

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
            arrowY - arrowLength * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
            arrowY - arrowLength * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();
        }
      });
    });
  };

  const drawSceneNodes = (ctx: CanvasRenderingContext2D) => {
    if (!scenes.value || !currentSceneData.value) return;

    const nodeRadius = 10;

    scenes.value.forEach((scene) => {
      if (!scene.position) return;

      // 设置节点样式
      if (scene.id === currentScene.value) {
        ctx.fillStyle = '#FF5733'; // 当前场景
      } else {
        // 检查当前场景是否可以直接前往该场景
        const canGo =
          currentSceneData.value?.connections &&
          currentSceneData.value.connections.includes(scene.id);
        ctx.fillStyle = canGo ? '#4A90E2' : '#999'; // 可前往/其他场景
      }

      // 绘制节点
      ctx.beginPath();
      ctx.arc(scene.position.x, scene.position.y, nodeRadius, 0, Math.PI * 2);
      ctx.fill();

      // 绘制节点边框
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 绘制节点标签
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(scene.title, scene.position.x, scene.position.y + nodeRadius + 10);
    });
  };

  const drawCameraDirection = (ctx: CanvasRenderingContext2D) => {
    if (!currentSceneData.value || !currentSceneData.value.position) return;

    // 获取相机旋转
    const camera = document.getElementById('camera');
    if (!camera) return;

    const rotation = camera.getAttribute('rotation');
    if (!rotation) return;

    // 相机Y轴旋转需要转换为2D平面上的角度
    const angle = (-rotation.y * Math.PI) / 180; // 转换为弧度，并取反

    // 绘制当前位置的方向箭头
    const nodeRadius = 10;
    const arrowSize = 15;

    ctx.save();
    ctx.translate(currentSceneData.value.position.x, currentSceneData.value.position.y);
    ctx.rotate(angle);

    // 绘制箭头主体
    ctx.beginPath();
    ctx.moveTo(0, -nodeRadius - arrowSize);
    ctx.lineTo(-arrowSize / 2, -nodeRadius);
    ctx.lineTo(arrowSize / 2, -nodeRadius);
    ctx.closePath();
    ctx.fillStyle = '#FF5733';
    ctx.fill();

    // 绘制箭头边框
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // 绘制方向线
    const lineLength = 25;
    const endX = currentSceneData.value.position.x + Math.cos(angle) * lineLength;
    const endY = currentSceneData.value.position.y + Math.sin(angle) * lineLength;

    ctx.beginPath();
    ctx.moveTo(currentSceneData.value.position.x, currentSceneData.value.position.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255, 87, 51, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 调试信息
    if (debugMode.value) {
      logDebug(
        `相机角度: ${rotation.y.toFixed(2)}°, 地图角度: ${((angle * 180) / Math.PI).toFixed(2)}°`,
      );
    }
  };

  // 更新视角方向指示器
  const updateViewDirection = () => {
    // 更新小地图
    if (!isMinimapCollapsed.value) drawMinimap();
  };

  // 小地图点击处理
  const handleMinimapClick = (evt: MouseEvent) => {
    if (!minimapCanvas.value || !currentSceneData.value || !currentSceneData.value.position) return;

    const rect = minimapCanvas.value.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const centerX = minimapCanvas.value.width / 2;
    const centerY = minimapCanvas.value.height / 2;

    const clickX = (x - centerX) / minimapScale.value + currentSceneData.value.position.x;
    const clickY = (y - centerY) / minimapScale.value + currentSceneData.value.position.y;

    // 查找点击位置的场景
    const nodeRadius = 10;
    const clickedScene = scenes.value.find((scene) => {
      if (!scene.position) return false;
      const dx = clickX - scene.position.x;
      const dy = clickY - scene.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= nodeRadius;
    });

    if (clickedScene && clickedScene.id !== currentScene.value) {
      // 检查当前场景是否可以直接前往该场景
      if (
        currentSceneData.value.connections &&
        currentSceneData.value.connections.includes(clickedScene.id)
      ) {
        // 找到对应的热点
        const hotspot = currentHotspots.value.find((h) => h.targetScene === clickedScene.id);
        if (hotspot) {
          const hotspotEl = document.getElementById(`hotspot-${hotspot.id}`);
          if (hotspotEl) hotspotEl.dispatchEvent(new Event('click'));
        }
      } else {
        logDebug(`当前场景没有通往 ${clickedScene.title} 的路径`);
        showFeedback(`无法直接前往: ${clickedScene.title}`);
      }
    }
  };

  // 注册相机旋转监听器
  const setupRotationListener = () => {
    // 如果已经注册过，先移除
    if (rotationListener.value) {
      const scene = document.querySelector('a-scene');
      if (scene) {
        scene.removeAttribute('rotation-listener');
      }
    }

    // 创建新的监听器组件
    rotationListener.value = AFRAME.registerComponent('rotation-listener', {
      tick: function () {
        const camera = document.getElementById('camera');
        if (camera) {
          const rotation = camera.getAttribute('rotation');
          if (rotation) {
            updateViewDirection();
          }
        }
      },
    });

    // 应用到场景
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.setAttribute('rotation-listener', '');
    }
  };

  // 热点点击事件处理
  const handleHotspotClick = (evt: CustomEvent) => {
    const { target, title, element } = evt.detail;
    logDebug(`点击了热点: ${title} (目标: ${target})`);
    showFeedback(`前往: ${title}`);

    const hotspotPosition = new THREE.Vector3();
    element.object3D.getWorldPosition(hotspotPosition);

    changeScene(target, hotspotPosition);
  };

  // 初始化
  const init = () => {
    // 加载场景数据
    loadScenes();

    // 设置初始化标志
    isInitialized.value = true;

    // 初始化热点
    updateHotspots();

    // 设置相机旋转监听器
    setupRotationListener();

    // 监听热点点击事件
    document.addEventListener('hotspot-click', handleHotspotClick as EventListener);

    // 初始化小地图
    drawMinimap();

    logDebug('全景查看器初始化完成');
  };

  // 清理事件监听器
  const cleanupEventListeners = () => {
    document.removeEventListener('hotspot-click', handleHotspotClick as EventListener);

    // 移除相机旋转监听器
    if (rotationListener.value) {
      const scene = document.querySelector('a-scene');
      if (scene) {
        scene.removeAttribute('rotation-listener');
      }
    }
  };

  // 监听场景变化，更新热点
  watch(currentScene, () => {
    if (isInitialized.value) {
      // 更新天空球
      const sky = document.getElementById('sky');
      if (sky) {
        sky.setAttribute('src', `#panorama-${currentScene.value}`);
      }

      updateHotspots();
    }
  });

  // 组件挂载后初始化
  onMounted(() => {
    // 注册A-Frame组件
    registerAFrameComponents();

    // 创建A-Frame场景
    createAFrameScene();

    // 使用更健壮的方式等待A-Frame初始化完成
    const checkSceneLoaded = () => {
      const scene = document.querySelector('a-scene');
      if (scene) {
        if (scene.hasLoaded) {
          init();
        } else {
          scene.addEventListener('loaded', init);
        }
      } else {
        // 如果场景元素还不存在，等待一段时间后再检查
        setTimeout(checkSceneLoaded, 100);
      }
    };

    // 开始检查
    checkSceneLoaded();
  });

  // 组件卸载前清理
  onBeforeUnmount(() => {
    cleanupEventListeners();

    // 清理A-Frame场景
    if (aframeContainer.value) {
      const scene = aframeContainer.value.querySelector('a-scene');
      if (scene) {
        scene.parentNode?.removeChild(scene);
      }
    }
  });
</script>

<style scoped>
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .control-btn {
    @apply w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors;
  }

  .minimap-container {
    @apply w-[220px] h-[220px] bg-black/70 rounded-lg p-3 text-white flex flex-col shadow-lg transition-all duration-300 overflow-hidden;
  }

  .minimap-direction-arrow {
    width: 12px;
    height: 12px;
    margin-right: 5px;
    position: relative;
  }

  .minimap-direction-arrow:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 12px solid #ff5733;
  }

  .info-panel {
    @apply absolute top-20 right-5 bg-black/70 text-white p-4 rounded-lg max-w-[250px] z-30;
  }

  .debug-panel {
    @apply absolute bottom-5 left-5 bg-black/70 text-white p-3 rounded-lg max-w-[300px] z-30 text-xs;
  }

  .feedback-message {
    @apply absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/30 text-white py-2 px-5 rounded-full z-30 pointer-events-none transition-opacity duration-300;
  }

  .view-direction {
    @apply absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full z-30 pointer-events-none;
  }

  .transition-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.8) 100%);
    opacity: 0;
    pointer-events: none;
    z-index: 50;
    transition: opacity 0.3s ease;
  }

  .zoom-effect {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: scale(1);
    opacity: 1;
    pointer-events: none;
    z-index: 40;
    transition: transform 0.8s ease, opacity 0.8s ease;
  }

  .direction-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100px;
    height: 100px;
    opacity: 0;
    pointer-events: none;
    z-index: 60;
    background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>')
      no-repeat center center;
    background-size: contain;
    transition: opacity 0.3s ease, transform 0.5s ease;
  }

  .notification {
    @apply fixed top-5 left-1/2 transform -translate-x-1/2 bg-black/70 text-white py-2 px-4 rounded-lg z-50 transition-opacity duration-300;
  }
</style>
