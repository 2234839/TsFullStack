// tailwind.config.js 
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

export default {
  theme: {
    extend: {
      colors: {
        // 主色调 - 青绿色系 (Cyan/Teal 混合) - 使用 OKLCH 颜色空间
        primary: {
          50: 'oklch(98.4% 0.019 200.873)',
          100: 'oklch(95.6% 0.045 203.388)',
          200: 'oklch(91.7% 0.08 205.041)',
          300: 'oklch(86.5% 0.127 207.078)',
          400: 'oklch(78.9% 0.154 211.53)',
          500: 'oklch(71.5% 0.143 215.221)',
          600: 'oklch(60.9% 0.126 221.723)',
          700: 'oklch(52% 0.105 223.128)',
          800: 'oklch(45% 0.085 224.283)',
          900: 'oklch(39.8% 0.07 227.392)',
          950: 'oklch(30.2% 0.056 229.695)',
        },
        // 辅助色 - 石板蓝灰系 (Slate Blue) - 使用 OKLCH 颜色空间
        // 与 primary 形成对比，但不争抢注意力，适合次要操作
        secondary: {
          50: 'oklch(98% 0.005 250)',
          100: 'oklch(95% 0.01 250)',
          200: 'oklch(90% 0.02 250)',
          300: 'oklch(82% 0.04 250)',
          400: 'oklch(70% 0.06 250)',
          500: 'oklch(58% 0.08 250)',
          600: 'oklch(48% 0.09 250)',
          700: 'oklch(40% 0.08 250)',
          800: 'oklch(34% 0.06 250)',
          900: 'oklch(28% 0.05 250)',
          950: 'oklch(20% 0.04 250)',
        },
        // 成功色 - 绿色系 (Green) - 使用 OKLCH 颜色空间
        success: {
          50: 'oklch(98.2% 0.018 155.826)',
          100: 'oklch(96.2% 0.044 156.743)',
          200: 'oklch(92.5% 0.084 155.995)',
          300: 'oklch(87.1% 0.15 154.449)',
          400: 'oklch(79.2% 0.209 151.711)',
          500: 'oklch(72.3% 0.219 149.579)',
          600: 'oklch(62.7% 0.194 149.214)',
          700: 'oklch(52.7% 0.154 150.069)',
          800: 'oklch(44.8% 0.119 151.328)',
          900: 'oklch(39.3% 0.095 152.535)',
          950: 'oklch(26.6% 0.065 152.934)',
        },
        // 警告色 - 琥珀色系 (Amber) - 使用 OKLCH 颜色空间
        warning: {
          50: 'oklch(98.7% 0.022 95.277)',
          100: 'oklch(96.2% 0.059 95.617)',
          200: 'oklch(92.4% 0.12 95.746)',
          300: 'oklch(87.9% 0.169 91.605)',
          400: 'oklch(82.8% 0.189 84.429)',
          500: 'oklch(76.9% 0.188 70.08)',
          600: 'oklch(66.6% 0.179 58.318)',
          700: 'oklch(55.5% 0.163 48.998)',
          800: 'oklch(47.3% 0.137 46.201)',
          900: 'oklch(41.4% 0.112 45.904)',
          950: 'oklch(27.9% 0.077 45.635)',
        },
        // 危险色 - 玫瑰红系 (Rose) - 使用 OKLCH 颜色空间
        danger: {
          50: 'oklch(96.9% 0.015 12.422)',
          100: 'oklch(94.1% 0.03 12.58)',
          200: 'oklch(89.2% 0.058 10.001)',
          300: 'oklch(81% 0.117 11.638)',
          400: 'oklch(71.2% 0.194 13.428)',
          500: 'oklch(64.5% 0.246 16.439)',
          600: 'oklch(58.6% 0.253 17.585)',
          700: 'oklch(51.4% 0.222 16.935)',
          800: 'oklch(45.5% 0.188 13.697)',
          900: 'oklch(41% 0.159 10.272)',
          950: 'oklch(27.1% 0.105 12.094)',
        },
        // 信息色 - 天蓝色系 (Sky) - 使用 OKLCH 颜色空间
        info: {
          50: 'oklch(97.7% 0.013 236.62)',
          100: 'oklch(95.1% 0.026 236.824)',
          200: 'oklch(90.1% 0.058 230.902)',
          300: 'oklch(82.8% 0.111 230.318)',
          400: 'oklch(74.6% 0.16 232.661)',
          500: 'oklch(68.5% 0.169 237.323)',
          600: 'oklch(58.8% 0.158 241.966)',
          700: 'oklch(50% 0.134 242.749)',
          800: 'oklch(44.3% 0.11 240.79)',
          900: 'oklch(39.1% 0.09 240.876)',
          950: 'oklch(29.3% 0.066 243.157)',
        },
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.79rem',
        base: '.8rem',
        lg: '1.25rem',
        xl: '1.5rem',
      },
    },
  },
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/@jctcc/js-util/src/**/*.{vue,js,ts,jsx,tsx}',
    /** 扫描共享组件包的 tailwindcss calss 类，避免这里的样式不生效 */
    '../../packages/shared-frontend/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  // 手动切换深色模式  https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually
  darkMode: 'selector',
  plugins: [
    plugin(({ addComponents }) => {
      return addComponents({
        '.no-tailwind-reset': {
          all: 'revert',
        },
      });
    }),
  ],
} satisfies Config;
