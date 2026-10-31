# 需求图入口

本项目需求以 `notes/*.md` 为唯一真相，本文件是需求图的默认入口与总纲：用普通 Markdown 链接组织各需求笔记，说明每个笔记承载什么领域、彼此什么关系。新建需求笔记时在此补一行链接。

## 需求笔记

- [示例需求](示例需求.md) — 示例：需求块、实现链接与验收清单的写法
- [Effect v4 精致化改造](effect-v4-精致化改造.md) — Layer 主干 / TaggedError / Fiber 定时 / Cache / 队列锁续期 / API 风格
- [安全审查](安全审查.md) — 持续安全审计：已发现的漏洞与待修复项（只记录，修复时逐块 done）

## 账号合并只迁登录关系，不做业务数据迁移 [[merge-login-only]]

- 用户侧账号合并（mergeIntoAccount / mergeByMergeTicket）只迁移 OAuth 登录绑定：源账号删除全部会话并置 passwordLoginDisabled=true，成为无法登录的幽灵账号
- 禁止在用户侧自动迁移业务数据（token/task/order/userData/file 等）：以后新建表无法保证记得更新迁移清单，自动迁移必然腐化
- 确实需要数据迁移时由管理员处理，后续在管理员页面提供该能力（待做）
- 实现见 [accountApi.ts](apps/backend/src/api/authApi/accountApi.ts)
- [公众号消息指令](公众号消息指令.md) — / 前缀指令：绑定微信后自助更新群码/公众号码
