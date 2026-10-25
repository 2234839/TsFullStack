import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: { '*': 'vp check --fix' },
  fmt: {
    /** 沿用项目历史风格：单引号（oxfmt 0.74+ 默认双引号，必须显式声明防止全库重排） */
    singleQuote: true,
    printWidth: 120,
  },
});
