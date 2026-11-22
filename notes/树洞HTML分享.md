# 树洞 HTML 分享

## 上传 HTML 作为 iframe 嵌入树洞帖子 [[embed-html]]

用户经常用各类小工具（单文件 HTML 演示页）做演示，希望有一个可分享的链接给别人查看效果。树洞自带评论与可见性（公开/登录可见/私密），适合承载这个分享概念。

需求：

- 树洞发帖（主题帖）时可附带一个**纯静态单文件 HTML**（自包含，无外部依赖文件）
- 帖子详情中以 iframe 展示该 HTML 的运行效果
- 支持生成分享链接给别人查看（受帖子可见性约束）
- 上传的 HTML **不得能读取站点外部数据**：即使别人上传恶意 HTML，其他用户查看时也不能窃取其账号（cookie / localStorage / 同源接口）

安全设计（多层防御）：

- HTML 上传走专用入口（通用上传仍禁止 .html），强制 `mimetype: text/html`、`status: public`、`metadata.embedHtml` 标记，大小上限独立收紧
- 服务端提供免鉴权 GET `/embed/:fileId` 路由输出该文件，响应头强制：
  - `Content-Security-Policy: sandbox allow-scripts` —— 即使受害者直接打开该 URL（顶层导航），文档也是 opaque origin，无法读取本站 cookie/localStorage/发起带凭证的同源请求
  - `X-Content-Type-Options: nosniff`
  - 该路由从全局 CSP hook 中豁免（否则会被全站 CSP 覆盖）
- 前端 iframe 使用 `sandbox="allow-scripts"`（不含 `allow-same-origin`），iframe 内脚本运行在与本站隔离的 opaque origin
- serve 侧仅输出满足「public + text/html + embedHtml 标记」的文件，不信任帖子里的引用
- 实现见 [treehole.ts](apps/backend/src/api/appApi/treehole.ts)、[file.ts](apps/backend/src/api/authApi/file.ts)、[index.ts](apps/backend/src/server/index.ts)、[TreeholePostForm.vue](apps/website-frontend/src/pages/treehole/TreeholePostForm.vue)、[TreeholePost.vue](apps/website-frontend/src/pages/treehole/TreeholePost.vue)

## 未登录发帖引导与草稿保留 [[login-overlay-draft]]

未登录用户打开树洞表单时：允许编辑但不能发布，发布按钮仅置灰且无任何提示，用户完全无法理解。

需求：

- 未登录时表单顶部展示提示：「发布需要登录，内容会保留，登录后自动发布」，并提供「去登录」入口
- 发布按钮文案变为「登录并发布」，点击弹出登录浮层而非跳转登录页（跳转 = 整页刷新 = 草稿丢失）
- 登录组件可嵌入其他页面/作为浮层使用：从登录页抽取通用 `LoginForm` 组件，包含全部登录方式（账密+记住我、GitHub/LinuxDo OAuth、微信口令），登录页与浮层共用同一组件；props 提供 `redirectTo`（成功后导航）与 `stayOnSuccess`（成功只写会话不导航，emit `success`）
- 登录成功后浮层关闭并自动继续提交，表单组件全程不卸载，草稿天然不丢
- OAuth 整页跳转问题用「新 tab + postMessage 中继」解决：stayOnSuccess 场景 OAuth 按钮改为 `window.open` 新 tab 授权；回调页登录成功后把登录态 postMessage 给同源 opener 并等 ack，ack 后自动关闭 tab；无同源 opener 或无 ack 则回退为回调页内正常跳转（普通登录流程不受影响）
- 帖子内展示封装为通用组件 `SandboxEmbed`（沙箱 iframe + 页面内放大/收缩 80vh + 浏览器窗口全屏两级切换，toolbar 插槽放业务按钮），已登记 ComponentShowcase
- 新增帖子详情页 `/treehole/:id`（`getPostTree` 加载主帖，`TreeholePost` 渲染并自动加载回复，含 IDOR 防护回退）；列表主题帖标题可点击进入详情
- 实现见 [relay.ts](apps/website-frontend/src/pages/oauth/relay.ts)、[LoginForm.vue](apps/website-frontend/src/components/common/LoginForm.vue)、[LoginOverlay.vue](apps/website-frontend/src/components/common/LoginOverlay.vue)、[login.vue](apps/website-frontend/src/pages/login.vue)、[TreeholePostForm.vue](apps/website-frontend/src/pages/treehole/TreeholePostForm.vue)、[SandboxEmbed.vue](apps/website-frontend/src/components/common/SandboxEmbed.vue)、[TreeholeDetail.vue](apps/website-frontend/src/pages/treehole/TreeholeDetail.vue)、[ComponentShowcase.vue](apps/website-frontend/src/pages/components/ComponentShowcase.vue)
