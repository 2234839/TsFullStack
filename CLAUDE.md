## 项目概述

TsFullStack 是一个 TypeScript 全栈框架，支持前端直接操作数据库，无需编写后端 API 代码。

### 核心技术栈

- **后端**: TypeScript + ZenStack(类似Prisma) + Effect + Fastify
- **前端**: TypeScript + Vue 3 + Tailwind CSS + reka-ui（自定义组件库）+ @vueuse/core (多多使用use来简化vue中的逻辑)
- **浏览器扩展**: WXT + Vue 3 + Tailwind CSS

### 开发工作流

> **本项目使用 Vite+ (`vp`) 作为统一工具链**，所有依赖安装、脚本运行、lint/format/type-check 均使用 `vp` 命令，禁止直接使用 pnpm。详见 `AGENTS.md`。

```bash
# 后端开发,需要在 apps/backend/ 目录下执行
vp run build:lib          # 构建后端api接口包供前端掉用
vp run dev                # 启动开发服务器

# 编译构建tsfullstack网站和后端并发布到服务器
vp run --filter @tsfullstack/backend build:publish

# 发布成功后打 tag 并推送
git tag vX.X.X && git push origin main --tags

# 前端开发 (apps/website-frontend/)
vp run build              # 构建生产版本
vp run tsc                # 类型检查

# 浏览器扩展 (apps/InfoFlow/)
vp run dev                # 启动开发服务器
vp run build              # 构建扩展
```

### [Shared Frontend Package](packages/shared-frontend)

这个子包提供在多个前端模块间共享的工具和组件

### 组件库规范（强制）

所有 UI 组件分两层：

- **无头层**：基于 `reka-ui` primitives（Dialog/Dropdown/Popover/Select 等），负责行为与无障碍，不写死样式。相关文档:https://reka-ui.com/llms.txt
- **样式层**：`packages/shared-frontend/src/components/` 与 `apps/website-frontend/src/components/base/` 的成品组件，只做 Tailwind 类的组合

颜色一律使用 `src/style.css` 的 `@theme` 变量（OKLCH，如 `var(--color-primary-500)`），禁止硬编码 hex。

**新建或修改任何 UI 组件时，必须：**

1. 在组件展示页 `apps/website-frontend/src/pages/components/ComponentShowcase.vue`（路由 `/components`）添加对应的展示区块，无展示 = 组件不存在
2. 在浏览器中实际打开展示页验证：渲染正常、交互可用、控制台无 Vue 警告/报错、dark 模式正常
3. 遵守封装规则：不要在 props 里声明 `class`（交给 attrs 自动透传，声明了就必须手动绑定）；响应式数据禁止写入非响应式结构；禁止提交空实现（空目录/空文件不得进入导出清单）

### 重要说明

**后端 Effect v4 编码约束（防止造轮子回潮）**

后端以 Effect v4 为运行时标准，写新代码时禁止再手写 Effect 已有的原语。提交前自查：

1. **内存缓存/TTL/并发单飞** → 用 `Cache.make`（`Effect.runSync` 创建，`requireServicesAt: 'lookup'` 延迟依赖）。禁止手写 `Map + expiresAt 时间戳` 缓存、禁止 setInterval 清理循环、禁止 destroy 簿记
2. **定时任务** → 用 `Effect.repeat(Schedule.spaced/fixed)` + Fiber，禁止业务 `setInterval`；优雅关闭用 `Fiber.interruptAll`
3. **错误** → 业务错误用 `Data.TaggedError` 家族（`util/error.ts` 的 MsgError/LogoutError/ToLoginError），E 通道收窄；禁止吞错（`Effect.ignore` 至少换 `Effect.catch` 记日志）
4. **异步流程** → 用 `Effect.gen`，禁止 `.pipe(Effect.andThen)` 老风格；fire-and-forget 用 `Effect.runFork` 且在调用方 provide
5. **出站 fetch+json** → 统一走 `util/fetchJson.ts` 的 `fetchJsonOrThrow`（网络/HTTP/JSON 三类错误拆分），且必须带 `withFetchTimeout` 超时信号；禁止裸 `await fetch().then(r => r.json())`
6. **配置常量** → 可变业务参数（价格/限额等）进 Context Tag + Layer（参考 `Context/PricingConfig.ts`），不硬编码
7. **例外白名单**（这些场景保留手写实现，不要强行 Effect 化）：一次性消费语义的 Map（如 oauthStates 读到即删）、需原地递增的计数器（如 rateLimit）、静态注册表（如 adapterMap）

**数据库管理**

- 修改模型: `schema.zmodel`
- 修改 schema 后必须运行 `vp run zen` 生成 ZenStack 客户端
- **操作线上数据库前，必须先用 scp 把线上 SQLite 库拉到本地备份，再动手**（迁移、修数据、删除均不例外）：`scp "$SSH_TARGET:/root/app/TsFullStack/prisma/dev.db" ./backup/dev-$(date +%Y%m%d-%H%M%S).db`（SSH_TARGET 见 `.deploy-env`），备份成功后才允许执行后续操作

**架构特性**

- ZenStack: 声明式访问控制和行级安全
- RPC 系统: 前端直接调用后端 API，完整类型安全
- Effect: 函数式编程的错误处理和依赖注入

**前端开发**

- 前端开发规范详见 [apps/website-frontend/CLAUDE.md](apps/website-frontend/CLAUDE.md)

<!-- pact:start -->

## pact 需求契约系统

这个项目用 pact 管理需求：`notes/*.md` 是所有需求的唯一真相，每个需求段落是一个「块」（`## 标题 [[锚点]]`）。你和用户改了笔记，pact 就能通过内容 hash 检测出来；你改了代码，pact 也能反查这段代码当初是为了实现哪个需求写的。它的价值：需求不会口头丢失、改了什么有据可查、你和用户对「什么做完了」有一致认知。

工作方式：pact 用状态文件（notes/.pact.todo.jsonl）记录每个块的完成态。你实现完一个需求，运行 `pact todo --done <块ID>` 记账；用户之后改了某块正文，那一块会自动变回待办，不需要谁手工登记。

你需要做的事：

1. **开工前**：跑 `pact todo` 生成/刷新 TODO.md 并阅读它（notes/TODO.md），每一项都带完整需求正文，照着逐项实现即可。你改代码前如果想知道某文件/符号对应什么需求，跑 `pact refs <文件路径或符号>` 反查。
2. **实现中**：改代码落地需求；每实现完一块，先在对应需求块的正文里补一行实现链接（如 `实现见 [todo.ts](src/todo.ts)`），再执行 `pact todo --done <块ID>` 标记该块完成。注意：只标你确实做完的块，绝不全量清零。
3. **遇到「已移除」**：TODO.md 末尾会列出「笔记里已删掉但 pact 还有记录」的块。逐条判断：如果那是真需求被删但实现代码还在 → 代码成了孤儿实现，这不合理，提醒用户决定代码怎么处理，别动状态记录；如果只是无关紧要的内容（随手记、过时描述）删了就删了 → 执行 `pact todo --clean <块ID>` 清掉记录即可，不用打扰用户。
4. **遇到空块**：只有标题没有正文的块是占位标题。如果它下面的微观需求都已完成，直接对它 `--done` 即可；如果下面还没有完成的子需求，留着等用户补正文。
5. **注意区分**：你自己回填实现链接也会改变块内容，下轮检测时这类「非需求变更」直接 `--done` 标掉即可；但用户改的正文是真需求变更，需要按新内容重新实现。

需求图约定：`notes/index.md` 是需求的默认入口与总纲。项目有 index.md 时，开工先读它——它用普通 Markdown 链接组织各需求笔记的关联（领域入口、笔记间引用），是理解需求全貌的起点。你新建需求笔记时，若项目已有 index.md，应在其中补一行指向新笔记的链接；笔记之间的关联一律用普通 Markdown 链接表达（不用特有语法），这样 `pact refs`/`pact check` 天然能反查与校验。

落盘纪律：当用户在对话中直接提出新需求/新约束（而不是让你改代码），不要只在当前对话里完成然后丢弃——先把它记入 notes/ 对应笔记成为需求块（可经用户确认后写，或直接代写并告知位置），让 pact 管理；对话是易失的，笔记才是唯一真相。
<!-- pact:end -->
