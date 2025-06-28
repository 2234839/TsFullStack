<template>
  <svg v-if="type === '蓝霓虹'" width="1em" height="1em" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="perfectNeon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00F5FF"></stop>
        <stop offset="50%" stop-color="#0080FF"></stop>
        <stop offset="100%" stop-color="#8A2BE2"></stop>
      </linearGradient>
      <filter id="perfectGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="coloredBlur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    </defs>
    <rect
      x="20"
      y="15"
      width="70"
      height="80"
      rx="8"
      fill="none"
      stroke="url(#perfectNeon)"
      stroke-width="2"
      opacity="0.4"></rect>
    <rect
      x="25"
      y="10"
      width="70"
      height="80"
      rx="8"
      fill="rgba(0,245,255,0.05)"
      stroke="url(#perfectNeon)"
      stroke-width="3"
      filter="url(#perfectGlow)"></rect>
    <rect x="30" y="15" width="60" height="10" rx="5" fill="url(#perfectNeon)" opacity="0.8"></rect>
    <path
      d="M60 40 C52 28, 35 28, 35 45 C35 62, 60 75, 60 75 C60 75, 85 62, 85 45 C85 28, 68 28, 60 40 Z"
      fill="url(#perfectNeon)"
      filter="url(#perfectGlow)"></path>
    <path
      d="M51 48 L45 54 L51 60"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      filter="url(#perfectGlow)"></path>
    <path
      d="M69 48 L75 54 L69 60"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      filter="url(#perfectGlow)"></path>
    <path
      d="M57 45 L63 63"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
      filter="url(#perfectGlow)"></path>
    <rect
      x="70"
      y="70"
      width="30"
      height="25"
      rx="6"
      fill="rgba(138,43,226,0.9)"
      stroke="url(#perfectNeon)"
      stroke-width="2"
      filter="url(#perfectGlow)"></rect>
    <text
      x="85"
      y="86"
      text-anchor="middle"
      font-size="14"
      font-weight="bold"
      fill="white"
      filter="url(#perfectGlow)">
      TS
    </text>
    <circle cx="30" cy="30" r="2" fill="#00F5FF" opacity="0.8">
      <animate
        attributeName="opacity"
        values="0.4;1;0.4"
        dur="2s"
        repeatCount="indefinite"></animate>
    </circle>
    <circle cx="90" cy="25" r="1.5" fill="#8A2BE2" opacity="0.6">
      <animate
        attributeName="opacity"
        values="0.3;0.8;0.3"
        dur="1.8s"
        repeatCount="indefinite"></animate>
    </circle>
  </svg>
  <svg v-else-if="type === '橙3d'" width="1em" height="1em" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="perfect3d" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF6B35"></stop>
        <stop offset="50%" stop-color="#F7931E"></stop>
        <stop offset="100%" stop-color="#FFD23F"></stop>
      </linearGradient>
      <filter id="perfectShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow
          dx="2"
          dy="4"
          stdDeviation="3"
          flood-color="#000000"
          flood-opacity="0.2"></feDropShadow>
      </filter>
    </defs>
    <rect x="27" y="17" width="70" height="80" rx="8" fill="#000000" opacity="0.1"></rect>
    <rect
      x="25"
      y="10"
      width="70"
      height="80"
      rx="8"
      fill="rgba(255,255,255,0.95)"
      stroke="url(#perfect3d)"
      stroke-width="2"
      filter="url(#perfectShadow)"></rect>
    <rect x="30" y="15" width="60" height="10" rx="5" fill="url(#perfect3d)"></rect>
    <rect x="30" y="15" width="60" height="5" rx="2.5" fill="rgba(255,255,255,0.3)"></rect>
    <path
      d="M60 40 C52 28, 35 28, 35 45 C35 62, 60 75, 60 75 C60 75, 85 62, 85 45 C85 28, 68 28, 60 40 Z"
      fill="url(#perfect3d)"
      filter="url(#perfectShadow)"></path>
    <ellipse cx="50" cy="45" rx="8" ry="6" fill="rgba(255,255,255,0.4)"></ellipse>
    <path
      d="M51 48 L45 54 L51 60"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"></path>
    <path
      d="M69 48 L75 54 L69 60"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"></path>
    <path
      d="M57 45 L63 63"
      stroke="white"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"></path>
    <rect
      x="70"
      y="70"
      width="30"
      height="25"
      rx="6"
      fill="url(#perfect3d)"
      filter="url(#perfectShadow)"></rect>
    <rect x="70" y="70" width="30" height="12" rx="3" fill="rgba(255,255,255,0.2)"></rect>
    <text
      x="85"
      y="86"
      text-anchor="middle"
      font-size="14"
      font-weight="bold"
      fill="white"
      filter="url(#perfectShadow)">
      TS
    </text>
  </svg>
  <svg v-else-if="type === '紫动态'" width="1em" height="1em" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="perfectDynamic" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF0080">
          <animate
            attributeName="stop-color"
            values="#FF0080;#8000FF;#0080FF;#FF0080"
            dur="4s"
            repeatCount="indefinite"></animate>
        </stop>
        <stop offset="100%" stop-color="#0080FF">
          <animate
            attributeName="stop-color"
            values="#0080FF;#FF0080;#8000FF;#0080FF"
            dur="4s"
            repeatCount="indefinite"></animate>
        </stop>
      </linearGradient>
      <filter id="perfectDynamicGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="coloredBlur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    </defs>
    <rect
      x="20"
      y="15"
      width="70"
      height="80"
      rx="8"
      fill="none"
      stroke="url(#perfectDynamic)"
      stroke-width="1"
      opacity="0.3"></rect>
    <rect
      x="25"
      y="10"
      width="70"
      height="80"
      rx="8"
      fill="rgba(128,0,255,0.08)"
      stroke="url(#perfectDynamic)"
      stroke-width="3"
      filter="url(#perfectDynamicGlow)"></rect>
    <rect
      x="30"
      y="15"
      width="60"
      height="10"
      rx="5"
      fill="url(#perfectDynamic)"
      filter="url(#perfectDynamicGlow)">
      <animate
        attributeName="opacity"
        values="0.8;1;0.8"
        dur="2s"
        repeatCount="indefinite"></animate>
    </rect>
    <g>
      <animateTransform
        attributeName="transform"
        type="scale"
        values="1;1.05;1"
        dur="2s"
        repeatCount="indefinite"
        transform-origin="60 55"></animateTransform>
      <path
        d="M60 40 C52 28, 35 28, 35 45 C35 62, 60 75, 60 75 C60 75, 85 62, 85 45 C85 28, 68 28, 60 40 Z"
        fill="url(#perfectDynamic)"
        filter="url(#perfectDynamicGlow)"></path>
    </g>
    <g>
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="1.5s"
        repeatCount="indefinite"></animate>
      <path
        d="M51 48 L45 54 L51 60"
        stroke="white"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
        filter="url(#perfectDynamicGlow)"></path>
      <path
        d="M69 48 L75 54 L69 60"
        stroke="white"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
        filter="url(#perfectDynamicGlow)"></path>
      <path
        d="M57 45 L63 63"
        stroke="white"
        stroke-width="3"
        stroke-linecap="round"
        fill="none"
        filter="url(#perfectDynamicGlow)"></path>
    </g>
    <rect
      x="70"
      y="70"
      width="30"
      height="25"
      rx="6"
      fill="rgba(255,255,255,0.15)"
      stroke="url(#perfectDynamic)"
      stroke-width="2"
      filter="url(#perfectDynamicGlow)"></rect>
    <text
      x="85"
      y="86"
      text-anchor="middle"
      font-size="14"
      font-weight="bold"
      fill="url(#perfectDynamic)"
      filter="url(#perfectDynamicGlow)">
      TS
    </text>
  </svg>
</template>

<script setup lang="ts">
  // 可以在这里定义组件的 props 或其他逻辑
  defineProps({
    type: {
      type: String as () => '蓝霓虹' | '橙3d' | '紫动态',
      default: '蓝霓虹',
    },
  });
</script>
