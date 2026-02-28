# 颜色使用指南

## 概述

本项目使用统一的 Tailwind CSS 颜色系统，所有颜色都基于语义化的命名约定，支持明暗模式自动切换。

**设计理念**: 采用青绿色系作为主色调，打造独特、专业、清新的视觉风格，避免使用被滥用的蓝紫色 AI 风格。

## 颜色系统

### 主色调 (Primary) - 青绿色
**用途**: 主要操作、主要按钮、链接、品牌色
**特点**: 清新、专业、独特，类似于 GitHub、Linear 的配色风格
```html
<!-- 好的做法 -->
<button class="bg-primary-600 hover:bg-primary-700 text-white">提交</button>
<div class="text-primary-600">重要信息</div>
<div class="border-primary-500">边框</div>

<!-- 不好的做法 -->
<button class="bg-blue-600 hover:bg-blue-700 text-white">提交</button>
```

### 辅助色 (Secondary) - 靛蓝色
**用途**: 次要操作、次要按钮、补充信息
**特点**: 沉稳、专业，与青绿色形成和谐对比
```html
<button class="bg-secondary-600 hover:bg-secondary-700 text-white">取消</button>
<div class="text-secondary-600">次要信息</div>
```

### 成功色 (Success)
**用途**: 成功状态、确认操作、正向反馈
```html
<div class="bg-success-50 text-success-700 border-success-200">
  操作成功！
</div>
<button class="bg-success-600 hover:bg-success-700 text-white">
  确认
</button>
```

### 警告色 (Warning)
**用途**: 警告状态、需要注意的信息
```html
<div class="bg-warning-50 text-warning-700 border-warning-200">
  请注意：此操作不可撤销
</div>
<div class="text-warning-600">
  <i class="pi pi-exclamation-triangle"></i> 警告
</div>
```

### 危险色 (Danger) - 玫瑰红色
**用途**: 危险操作、错误状态、删除操作
**特点**: 优雅、友好，不会过于刺眼
```html
<button class="bg-danger-600 hover:bg-danger-700 text-white">
  删除
</button>
<div class="bg-danger-50 text-danger-700 border-danger-200">
  操作失败，请重试
</div>
```

### 信息色 (Info) - 天蓝色
**用途**: 信息提示、帮助文本、中性信息
**特点**: 清爽、明亮，温和的信息传达
```html
<div class="bg-info-50 text-info-700 border-info-200">
  提示信息
</div>
<div class="text-info-600">
  <i class="pi pi-info-circle"></i> 信息
</div>
```

### 信息色 (Info)
**用途**: 信息提示、帮助文本、中性信息
```html
<div class="bg-info-50 text-info-700 border-info-200">
  提示信息
</div>
<div class="text-info-600">
  <i class="pi pi-info-circle"></i> 信息
</div>
```

## 明暗模式支持

所有颜色都支持明暗模式，使用 `dark:` 前缀：

```html
<!-- 文本色 -->
<div class="text-gray-900 dark:text-gray-100">标题</div>
<div class="text-gray-600 dark:text-gray-400">正文</div>

<!-- 背景色 -->
<div class="bg-white dark:bg-gray-800">卡片</div>
<div class="bg-gray-50 dark:bg-gray-900">页面背景</div>

<!-- 边框色 -->
<div class="border-gray-200 dark:border-gray-700">边框</div>
```

## 颜色使用规范

### 1. 按钮颜色
```html
<!-- 主按钮 -->
<Button class="bg-primary-600 hover:bg-primary-700">提交</Button>

<!-- 次按钮 -->
<Button class="bg-secondary-600 hover:bg-secondary-700">取消</Button>

<!-- 成功按钮 -->
<Button class="bg-success-600 hover:bg-success-700">确认</Button>

<!-- 危险按钮 -->
<Button class="bg-danger-600 hover:bg-danger-700">删除</Button>
```

### 2. 状态颜色
```html
<!-- 成功状态 -->
<div class="text-success-600 bg-success-50">✓ 成功</div>

<!-- 警告状态 -->
<div class="text-warning-600 bg-warning-50">⚠ 警告</div>

<!-- 错误状态 -->
<div class="text-danger-600 bg-danger-50">✗ 错误</div>

<!-- 信息状态 -->
<div class="text-info-600 bg-info-50">ℹ 信息</div>
```

### 3. 文本层级
```html
<!-- 主标题 -->
<h1 class="text-gray-900 dark:text-gray-100">标题</h1>

<!-- 副标题 -->
<h2 class="text-gray-700 dark:text-gray-200">副标题</h2>

<!-- 正文 -->
<p class="text-gray-600 dark:text-gray-400">正文内容</p>

<!-- 辅助文本 -->
<span class="text-gray-500 dark:text-gray-500">辅助信息</span>
```

### 4. 背景层级
```html
<!-- 页面背景 -->
<div class="bg-gray-50 dark:bg-gray-900">页面</div>

<!-- 卡片背景 -->
<div class="bg-white dark:bg-gray-800">卡片</div>

<!-- 悬浮背景 -->
<div class="bg-gray-100 dark:bg-gray-700">悬浮区域</div>
```

## 颜色数值说明

每个颜色色系有 50-950 共 10 个等级：
- **50-100**: 最浅，用于背景色
- **200-300**: 浅色，用于背景、边框
- **400-500**: 中等，用于默认状态
- **600-700**: 深色，用于 hover 状态、强调
- **800-900**: 很深，用于文本、深色背景
- **950**: 最深，用于特殊场景

## 迁移指南

### 替换硬编码颜色

**之前（不好）:**
```vue
<div class="bg-blue-500 text-white">按钮</div>
<div class="text-red-600">错误信息</div>
<div class="border-green-500">成功状态</div>
```

**之后（推荐）:**
```vue
<div class="bg-primary-600 text-white">按钮</div>
<div class="text-danger-600">错误信息</div>
<div class="border-success-500">成功状态</div>
```

## 组件示例

### 消息提示组件
```vue
<template>
  <div
    class="border rounded-lg p-4"
    :class="{
      'bg-success-50 text-success-700 border-success-200': severity === 'success',
      'bg-warning-50 text-warning-700 border-warning-200': severity === 'warning',
      'bg-danger-50 text-danger-700 border-danger-200': severity === 'error',
      'bg-info-50 text-info-700 border-info-200': severity === 'info',
    }"
  >
    <slot></slot>
  </div>
</template>
```

### 按钮组件
```vue
<template>
  <button
    class="px-4 py-2 rounded-lg text-white transition-colors"
    :class="{
      'bg-primary-600 hover:bg-primary-700': variant === 'primary',
      'bg-secondary-600 hover:bg-secondary-700': variant === 'secondary',
      'bg-success-600 hover:bg-success-700': variant === 'success',
      'bg-danger-600 hover:bg-danger-700': variant === 'danger',
    }"
  >
    <slot></slot>
  </button>
</template>
```

## 注意事项

1. **永远不要使用硬编码的颜色值**（如 `#3b82f6`）
2. **优先使用语义化的颜色名称**，而不是直接的颜色名（如 `blue`、`red`）
3. **始终考虑明暗模式**，为浅色和深色模式都提供合适的颜色
4. **保持一致性**，相同的用途应该使用相同的颜色
5. **确保可访问性**，文本和背景之间要有足够的对比度

## 相关资源

- [Tailwind CSS 颜色文档](https://tailwindcss.com/docs/customizing-colors)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
