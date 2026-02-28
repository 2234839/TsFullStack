## shard-frontend 开发规范

- 当前包是共享给其他包使用的，所以要考虑通用性，每次修改时还要考虑是否会波及其他使用此包的monorepo内项目
- 使用 vue3 + ts + reka-ui 组件库 + tailwindcss 构建组件
- 注意基于 tailwindcss 做好响应式以及暗色模式的适配