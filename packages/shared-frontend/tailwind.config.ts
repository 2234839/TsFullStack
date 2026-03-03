// tailwind.config.js
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

export default {
  theme: {
    extend: {
      colors: {
        /**
         * 主色调 - 中性灰黑白系 (Noir 风格)
         * 参考 PrimeVue 的 Noir 模式设计
         * 明亮模式：以深灰/黑色为主
         * 暗色模式：以浅灰/白色为主
         */
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        /**
         * 辅助色 - 蓝灰系 (Slate)
         * 用于次要操作，与 primary 形成微妙对比
         */
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        /**
         * 成功色 - 绿色系
         * 保持原有绿色，用于成功状态提示
         */
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        /**
         * 警告色 - 琥珀色系
         * 保持原有琥珀色，用于警告状态提示
         */
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        /**
         * 危险色 - 红色系
         * 保持原有红色，用于错误/危险状态提示
         */
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        /**
         * 信息色 - 蓝色系
         * 保持原有蓝色，用于信息提示
         */
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
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
    './src/**/*.{vue,js,ts,jsx,tsx}',
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
