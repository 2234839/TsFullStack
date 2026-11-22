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
