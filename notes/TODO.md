# TODO

> 由 `pact todo` 生成，勿手改。按 diff 组织：每块只列差异行（+ 新 / - 旧），实现后 `pact todo --done <块ID>` 标记完成。已删除的块用 `pact todo --clean <块ID>` 清理记录。共 34 项待办。

## 新增：[账号合并只迁登录关系，不做业务数据迁移](index.md)

- 块 ID: `index.md#merge-login-only`

```diff
+ - 用户侧账号合并（mergeIntoAccount / mergeByMergeTicket）只迁移 OAuth 登录绑定：源账号删除全部会话并置 passwordLoginDisabled=true，成为无法登录的幽灵账号
+ - 禁止在用户侧自动迁移业务数据（token/task/order/userData/file 等）：以后新建表无法保证记得更新迁移清单，自动迁移必然腐化
+ - 确实需要数据迁移时由管理员处理，后续在管理员页面提供该能力（待做）
+ - 实现见 [accountApi.ts](apps/backend/src/api/authApi/accountApi.ts)
+ - [公众号消息指令](公众号消息指令.md) — / 前缀指令：绑定微信后自助更新群码/公众号码
```

## 新增：[需求来源：私域引流功能运营自动化（2026-10-31 对话确认）。](公众号消息指令.md)

- 块 ID: `公众号消息指令.md#需求来源：私域引流功能运营自动化（2026-10-31 对话确认）。`

```diff
+ 需求来源：私域引流功能运营自动化（2026-10-31 对话确认）。
```

## 新增：[背景与目标](公众号消息指令.md)

- 块 ID: `公众号消息指令.md#wechat-command-bg`

```diff
+ - 现状：公众号关键词回复出群码（GroupEntryService.getActiveQrByReplyKeyword），群码/公众号码只能管理员在网页后台上传
+ - 目标：允许用户在网页绑定微信后，**直接在公众号对话里发指令更新群二维码/公众号二维码**，运营不用开电脑登后台
+ - 查看消息渠道现状：POST /wechat → PasscodeService.verify（口令优先）→ handleTextMessage 关键词出码；已有资产 parseWechatMessage / cachedReply（msgId 幂等）/ uploadTempImage / GroupSpace / GroupQRCode / oAuthAccount(WECHAT) 绑定关系
```

## 新增：[指令设计](公众号消息指令.md)

- 块 ID: `公众号消息指令.md#wechat-command-design`

```diff
+ - **指令前缀用 `/`**（不是 `#`）：IRC/Telegram 等主流约定、中文关键词无冲突、键盘好输入；未授权用户发指令回引导文案不沉默
+ - 指令路由插在口令验证之前还是之后：**口令验证优先**（登录流程不能被指令打断），指令其次，关键词出码最后
+ - 鉴权链：openid → oAuthAccount(provider=WECHAT) → userId → GroupSpaceOperator 校验其对该空间的操作权（见「权限与身份」节，不建独立白名单）
+ - 指令集：
+   - `/帮助` 列出指令
+   - `/状态 [空间]` 查看各空间群码/公众号码有效期
+   - `/更新群码 <空间名>` 进入待图会话 → 用户发图片消息 → media/get 下载原图入库（新增 GroupQRCode，7 天轮换）
+   - `/更新公众号码 <空间名>` 同上（更新 GroupSpace.officialQrImagePath）
+ - 多步会话：内存 Map<openid, {cmd, spaceName, expiresAt}>，5 分钟超时
+ - 图片消息处理：优先 media_id 走 media/get 下载，失败回退 PicUrl；走 cachedReply(openid:msgId) 幂等防微信 5s 重试重复入库
+ - 实现见 [wechat.ts](../../apps/backend/src/server/wechat.ts) 与 [WechatCommandService](../../apps/backend/src/services/WechatCommandService.ts)（实现后回填）
```

## 新增：[验收](公众号消息指令.md)

- 块 ID: `公众号消息指令.md#wechat-command-accept`

```diff
+ - 未绑定用户发 `/帮助` 收到绑定引导
+ - 已绑定授权用户 `/更新群码 <空间>` 后发图片，GroupQRCode 新增一条且公众号关键词立即出新码
+ - 微信重试（同 msgId）不产生重复入库
```

## 新增：[持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。](安全审查.md)

- 块 ID: `安全审查.md#持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。`

```diff
+ 持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。
```

## 新增：[会话令牌与口令轮询票据使用 cuid2 生成，熵源是 Math.random 而非 CSPRNG](安全审查.md)

- 块 ID: `安全审查.md#sec.session-token-cuid`

```diff
+ 两处安全敏感字段都用 `@default(cuid())`（[schema.zmodel](apps/backend/schema.zmodel)）：
+
+ - `UserSession.token`（第 161 行）——登录会话令牌，即全部鉴权凭据（`x-token-id` 头、GET 签名模式的 HMAC 密钥）
+ - `VerificationPasscode.ticket`（第 208 行）——schema 注释自述"secret，仅发起方持有"，是口令登录/绑定/合并验证的轮询凭据
+
+ 已确认 ZenStack v3 的 `cuid()` 底层是 @paralleldrive/cuid2@2.3.1，其随机源是 **`Math.random()`**（xorshift128+，非密码学安全，见 node_modules 源码 `createEntropy(random = Math.random)`），再混入时间戳/计数器/进程指纹后 sha3。
+
+ 风险：本进程内所有模型 id（userId、fileId 等大量返回给客户端的 cuid）都来自同一个 Math.random 流。V8 的 Math.random 状态可由若干个连续输出反推（公开研究），攻击者拿到自己请求响应里的一批 cuid 后有可能预测/恢复内部状态，进而：
+
+ 1. 伪造其他用户的**会话令牌**（完全接管）
+ 2. 预测他人的**口令轮询 ticket** → 在真实发起者轮询前抢先 `checkWechatLogin` 消费 VERIFIED 口令，**登录成正在登录中的他人账号**（会话劫持）
+
+ 建议：两处都改为 `randomBytes(32).toString('base64url')`（项目里 [passcode.ts](apps/backend/src/api/appApi/passcode.ts) 的 mergeTicket 已是这种正确做法，保持一致）。存量 cuid 令牌在用户下次登录时自然轮换。
+
+ 严重度：高。
+ ### 验收
+ - UserSession.token 与 VerificationPasscode.ticket 不再由 cuid 生成，改用 crypto 随机源
+ - 存量令牌无需迁移脚本即可平滑过渡
```

## 新增：[鉴权用户缓存 10 分钟，会话撤销/禁用密码登录延迟生效](安全审查.md)

- 块 ID: `安全审查.md#sec.auth-cache-staleness`

```diff
+ [authCache.ts](apps/backend/src/server/authCache.ts) 的 `userCache` TTL 10 分钟，key 含 sessionToken/sessionID。`getDbAuthEffect` 查询本身校验 `expiresAt > now`（[DbService.ts](apps/backend/src/Context/DbService.ts)），但命中缓存后不再查库，导致：
+
+ - 登出、账号合并的 `userSession.deleteMany`（[accountApi.ts](apps/backend/src/api/authApi/accountApi.ts)）后，旧会话最长 10 分钟内仍可通过 `/api/*` 鉴权
+ - `passwordLoginDisabled` 切换后最长 10 分钟内旧状态仍生效
+
+ 风险：账号被合并/主动登出后凭据残留窗口；共享设备场景登出后他人仍可用。属于会话撤销时效问题。
+
+ 严重度：中。
+ ### 验收
+ - 会话删除/用户状态变更后，该会话的后续鉴权请求立即（或秒级）失效
+ - 可用 Cache.invalidate 按精确 key 失效，或缩短敏感场景 TTL
```

## 新增：[GET 签名认证：签名只覆盖 args，不含方法名，且无时效可永久重放](安全审查.md)

- 块 ID: `安全审查.md#sec.get-sign-no-binding`

```diff
+ [server/index.ts](apps/backend/src/server/index.ts) 的 `parseParamsAndAuth`：GET 请求用 `?session=<id>&sign=<hex>` 认证，`verifySignByToken(query.args, session.token, sign)` 只对 **args 字符串** 做 HMAC（[SessionAuthSign.ts](apps/backend/src/lib/SessionAuthSign.ts)）。问题：
+
+ 1. 签名不绑定请求的方法名/路径——相同 args 的签名可在接受同形参数的其他 GET 端点间复用（跨端点重放）
+ 2. 无时间戳/nonce——`UserSession` 无过期上限语义下，泄露一次 URL（Referrer、日志、分享链接）即永久可用
+
+ 建议：签名原文改为 `method + '?' + args`，并附加过期时间戳参与签名与校验。
+
+ 严重度：中。
+ ### 验收
+ - 签名校验的输入包含 RPC 方法名与参数，跨方法不可复用
+ - 签名带有效期，过期拒绝
```

## 新增：[密码爆破防护仅账号维度递增延迟，无 IP 维度限制](安全审查.md)

- 块 ID: `安全审查.md#sec.bruteforce-account-only`

```diff
+ [auth.ts](apps/backend/src/api/appApi/auth.ts) 的失败延迟按 email 计数（Cache 10 分钟 TTL，封顶 5 秒）。攻击者对单账号可持续每 ~5 秒试一次且无锁定上限；换 IP/分布式对多账号喷洒时每账号独立计数，防护趋近于零。`mergeIntoAccount`、`setPasswordLoginDisabled`、`verifyByEmailPwd` 各自的 randomDelay(500-1000ms) 同样只是固定限速。
+
+ 建议：补 IP/全局维度的失败限速（如复用 PasscodeService 的失败计数+封禁模式），并考虑连续失败 N 次后临时锁定账号。
+
+ 严重度：中低。
+ ### 验收
+ - 同 IP 高频密码失败触发封禁/验证码
+ - 单账号失败有累计上限（不止延迟递增）
```

## 新增：[登录响应时序差异泄露邮箱注册状态](安全审查.md)

- 块 ID: `安全审查.md#sec.login-timing-enumeration`

```diff
+ [auth.ts](apps/backend/src/api/appApi/auth.ts)：`!user || !(yield* comparePassword(password, user.password))` 短路求值——用户不存在时跳过 bcrypt compare（约 100ms），与「用户存在但密码错」响应时序不同，可枚举已注册邮箱。失败延迟对两条路径相同，无法抵消 bcrypt 时长差。
+
+ 建议：用户不存在时对固定长度的 dummy hash 做 compare，抹平时序。
+
+ 严重度：低。
+ ### 验收
+ - 用户不存在与密码错误两条路径的响应耗时统计上不可区分
```

## 新增：[全局口令验证封禁可被恶意触发，DoS 全站口令登录](安全审查.md)

- 块 ID: `安全审查.md#sec.global-verify-ban-dos`

```diff
+ [PasscodeService.ts](apps/backend/src/services/PasscodeService.ts) `verify` 的 `globalKey = 'verify:global'` 失败 10 次/10 分钟即封禁**所有人**的微信口令登录 5 分钟。攻击者向公众号随意发 10 个错误 code 即可周期性拒绝全部用户口令登录。单身份封禁是必要的，全局封禁把可用性交给了攻击者。
+
+ 建议：全局门限提高或改为按 IP/按 code 维度计数；保留单身份封禁。
+
+ 严重度：低。
+ ### 验收
+ - 攻击者无法通过少量失败请求阻塞其他正常用户的口令验证
```

## 新增：[匿名口令创建接口无速率限制，可灌库](安全审查.md)

- 块 ID: `安全审查.md#sec.passcode-create-nolimit`

```diff
+ `passcodeApi.createWechatLogin / createWechatMergeVerify`（app-api 匿名）每次调用执行一条 `deleteMany(过期)` + 一条 `create`，无任何限流/Captcha。脚本可高频调用造成 SQLite 写放大与表膨胀（虽然有过期清理，但清理只删已过期记录，持续高频创建会持续占用写吞吐）。
+
+ 建议：按 IP 限流（如每分钟 N 次）。
+
+ 严重度：低。
+ ### 验收
+ - 匿名创建口令接口有按 IP 的速率上限
```

## 新增：[支付发货前不校验回调金额，MBD 与爱发电金额单位还不一致](安全审查.md)

- 块 ID: `安全审查.md#sec.payment-amount-unchecked`

```diff
+ [PaymentService.ts](apps/backend/src/services/payment/PaymentService.ts) `handleWebhook`：回调验签通过且 `paymentStatus === 'success'` 即标记 PAID 并发代币，**从不比较 `parsed.paidAmount` 与订单应付金额**（`order.amount`，单位为分，见 [schema.zmodel](apps/backend/schema.zmodel) 的 `price（分）`）。
+
+ 两个问题：
+
+ 1. **少付多发**：金额校验完全缺位。任何导致回调金额与订单不符的场景（平台侧自定义金额/赞助金额可改、渠道配置异常、未来接入新渠道忘了校验）都会按原套餐全额发货。正确做法：发货前 `paidAmount >= order.amount` 不满足则拒绝并告警走人工。
+ 2. **单位不一致**：爱发电适配器把回调金额 `* 100` 转分（[afdian.adapter.ts](apps/backend/src/services/payment/adapters/afdian.adapter.ts) `YUAN_TO_FEN`），MBD 适配器直接 `Number(data.amount)` 存库（[mbd.adapter.ts](apps/backend/src/services/payment/adapters/mbd.adapter.ts)）。若面包多回调单位是元，则两渠道的 paidAmount 落库单位不同，一旦后续补上金额校验，MBD 渠道会全部误判。需核实面包多回调文档后统一为分。
+
+ 严重度：中（验签挡住了直接伪造，但业务逻辑缺一道关键闸门）。
+ ### 验收
+ - 发货前校验 `paidAmount >= order.amount`，不足时拒绝发货并记录告警日志
+ - 两个渠道的 paidAmount 落库单位统一为分，且有注释说明
```

## 新增：[文件上传无用户配额，注册账号可耗尽存储](安全审查.md)

- 块 ID: `安全审查.md#sec.upload-no-quota`

```diff
+ [file.ts](apps/backend/src/api/authApi/file.ts) `upload`：单文件上限 1GB（`MAX_UPLOAD_BYTES`），但无每用户总容量/文件数配额，且注册无门槛（无验证码）。脚本注册账号后循环上传 1GB 文件即可耗尽服务器磁盘，影响全站可用性（SQLite 同盘写入也会受牵连）。
+
+ 建议：按用户统计已用容量设上限（如 1-5GB），超限拒绝；配合 [[sec.passcode-create-nolimit]] 一起加注册限流。
+
+ 严重度：低（但 DoS 成本极低，建议尽早做）。
+ ### 验收
+ - 单用户存储总量有上限，超限上传被拒绝
+ - 匿名/新注册账号的滥用成本显著提高
```

## 新增：[分享详情接口保留自增 id 查询，UUID 防枚举被兼容逻辑绕过](安全审查.md)

- 块 ID: `安全审查.md#sec.share-legacy-id-enumerable`

```diff
+ [share.ts](apps/backend/src/api/appApi/share.ts) `detail(idOrKey)`：新链接是不可预测的 UUID key，但纯数字时直接按自增 `id` 查询（注释自述"兼容旧版存量分享不失效"）。自增 id 可被遍历（`id=1,2,3…`），匿名即可枚举拉取**所有**用户的分享内容——UUID 的防枚举设计被这一条 OR 分支整体绕过。
+
+ 建议：给存量分享批量补 key 后下线数字 id 分支；或至少对数字 id 查询限流并确认 shareInfo 内容无敏感数据。
+
+ 严重度：中低。
+ ### 验收
+ - 无法通过遍历数字 id 获取非自己创建的分享
+ - 存量分享链接有迁移方案（跳转或失效）
```

## 新增：[OAuth login/merge 意图不绑定发起会话，存在登录 CSRF 面](安全审查.md)

- 块 ID: `安全审查.md#sec.oauth-login-csrf`

```diff
+ OAuth state 已做一次性+过期校验，bind 意图还校验了 `initiatorUserId === 当前会话`（[github.ts](apps/backend/src/api/appApi/github.ts) 第 74-80 行，正确）。但：
+
+ 1. **login 意图**：state 与发起浏览器无任何绑定（无 cookie 关联）。攻击者可自己走完授权前半程拿到 code+state，再诱导受害者浏览器提交这对 code+state 到 authenticate——受害者会在无感知下**登录为攻击者的账号**（login CSRF），后续往"自己"账号里输入的数据实际进了攻击者账号。
+ 2. **merge 意图**：同样不记录发起者。被诱导者在登录态下完成渠道授权后，前端持有的 mergeTicket 对应攻击者的渠道身份；若前端确认页只展示"验证成功"而不明确展示渠道归属，被诱导者可能确认合并，把自己账号并给攻击者。
+
+ 建议：发起 OAuth 时向浏览器种一个随机 nonce cookie，回调时校验 code+state+nonce 三者配对；merge 确认页强制展示被合并账号的渠道与身份信息。
+
+ 严重度：中低（利用需要诱导交互，但后果是账号级）。
+ ### 验收
+ - OAuth 回调校验发起浏览器身份（nonce cookie 或等价机制）
+ - login CSRF 攻击路径不可行
```

## 新增：[AI 代理接口登录即可用且不扣代币，注册无门槛可白嫖 LLM 额度](安全审查.md)

- 块 ID: `安全审查.md#sec.ai-proxy-no-cost`

```diff
+ [AiApi/index.ts](apps/backend/src/api/AiApi/index.ts) `proxyOpenAI` 注册在 `/api`（仅需登录，非管理员），转发到服务端配置的 OpenAI 兼容模型。有 IP/用户/模型三维度限速（默认 60/min、1000/h、10000/day，[AIProxyService.ts](apps/backend/src/Context/AIProxyService.ts)），但**不消耗代币**——代币经济只在任务侧（taskApi）生效。baseUrl/apiKey 均取自服务端 DB 配置，无 SSRF 面（✓）。
+
+ 风险：注册无门槛（无验证码），脚本注册+轮换 IP 可批量消耗 LLM 配额/真金费用。若"免费代理"是设计意图，至少该把额度与代币或账号信誉挂钩。
+
+ 严重度：中低（取决于模型接入的真实成本）。
+ ### 验收
+ - proxyOpenAI 消耗代币或有等价的成本约束（与设计意图对齐后确认）
+ - 限速维度补充账号年龄/信誉等反滥用因子（可选）
```

## 新增：[AI 生图先出图后扣费，无余额账号可反复触发真实 AI 调用产生坏账](安全审查.md)

- 块 ID: `安全审查.md#sec.ai-image-pay-after-delivery`

```diff
+ [taskApi.ts](apps/backend/src/api/authApi/taskApi.ts) `generateAIImage` 的时序：`createTask`（**不检查余额**，[TaskService.ts](apps/backend/src/services/TaskService.ts) 仅建记录）→ `startTask` → 调用 AI 服务商（真实成本发生）→ `completeTask` → **最后才 `consumeTokens`**（此时才检查余额，失败仅把任务标记 failed）。
+
+ 后果：余额为 0 的账号每次请求都能让服务端完成一次真实的 AI 生图调用，扣费必然失败，坏账无人承担。脚本循环调用即可持续消耗 AI 服务商配额/费用（每用户 10 次/分钟的限速只是减速带，不设防）。
+
+ 建议：把余额检查+预扣（或冻结）提到 `createTask`/AI 调用之前；执行失败时再解冻退回。
+
+ 严重度：高（直接资金损失面，利用成本极低）。
+ ### 验收
+ - AI 调用发生前校验并预扣/冻结代币，失败退回
+ - 无余额账号的请求在触达 AI 服务商之前被拒绝
```

## 新增：[consumeTokens 并发截断增量导致少扣多发](安全审查.md)

- 块 ID: `安全审查.md#sec.consume-tokens-partial-deduct`

```diff
+ [TokenService.ts](apps/backend/src/services/TokenService.ts) `consumeTokens`：余额检查（事务外）→ 事务内重读 `used` 并计算 `actualIncrement = Math.min(expectedIncrement, current.amount - current.used)`，注释意图是"按实际增量防超支"，但**截断后不回滚**——`actualIncrement > 0 但 < expectedIncrement` 时事务照常提交。
+
+ 场景：余额 15，两个并发请求各需 10。请求 A 扣 10 余 5；请求 B 事务内读到余 5，截断后只扣 5 提交成功，但调用方任务按"消耗 10"照常执行（图已生成、任务已 complete）。净效果：成本 10 的任务只付了 5，**并发可稳定超支**。前置的 `totalAvailable < amount` 检查是 check-then-act，挡不住这个窗口。
+
+ 建议：`actualIncrement !== expectedIncrement` 时直接 throw 回滚整个事务（余额不足就走余额不足错误），而不是截断。
+
+ 严重度：中（配合上一条坏账问题被放大；单看会造成代币账目与实际服务不对等）。
+ ### 验收
+ - 并发消耗同一批代币时，任何一笔增量被截断都会整体回滚
+ - 账面消耗总和恒等于实际服务成本
```

## 新增：[ZenStack 策略对 Token/Order/Task 开放用户级 create/update，违背最小权限](安全审查.md)

- 块 ID: `安全审查.md#sec.zenstack-overbroad-create`

```diff
+ [schema.zmodel](apps/backend/schema.zmodel) 中多个资金/业务敏感模型对 `auth() == user` 开放了写权限：
+
+ - `Token @@allow('read,create,update,delete', auth() == user)`（第 732 行）——**create Token 即自发代币**
+ - `TokenTransaction @@allow('read', ...)` 只读 ✓，但 `Task @@allow('read,create,update,delete', auth() == user)`（第 841 行）——用户可改自己任务的 `status: COMPLETED`
+ - `Order @@allow('create', auth() != null && auth() == user)`（第 607 行）——用户可插入 `status: PAID` 的伪造订单记录
+
+ 当前没有直接利用路径：RPC 只暴露固定注册的 API 函数，前端拿不到 `auth.db` 通用 CRUD 入口，发货也不由"订单 status==PAID"驱动。但这是**一踩就响的地雷**：将来任何 API 把用户输入透传给 `auth.db.token.create` / `order.create`（或加一个通用 CRUD 端点）就是资金级漏洞。代币/订单的创建语义只应存在于服务端（DbClientEffect 路径）。
+
+ 建议：把这些模型的策略收窄为 `@@allow('read', auth() == user)`，写操作全部走服务端无权限客户端。
+
+ 严重度：中低（当下不可利用，属高危建模卫生问题）。
+ ### 验收
+ - Token / TokenTransaction / Order / Task 对普通用户只保留 read
+ - 全库 grep 确认无用户输入直达这些模型写操作的路径
```

## 新增：[其余备忘（暂不成块，持续观察）](安全审查.md)

- 块 ID: `安全审查.md#sec.misc-notes`

```diff
+ - 第三轮（diagApi/treehole/groupEntry/Post 策略）结论：`diagApi` 全部 `requireAdmin` ✓；treehole 的 IDOR 防护（私密帖仅作者、匿名仅 PUBLIC、authorId 强制本人）✓；groupEntry 管理令牌强制 ≥16 字符 ✓；ZenStack Post/Content 四档可见性策略无越权口子 ✓。
+ - 第四轮（testApi/systemApis/AiApi/TokenGrantService/API 注册表）结论：`testApi` 仅 sleep 计数无害；`_oauthUtil` 用 `randomBytes`（✓ 正确范本，与 [[sec.session-token-cuid]] 互证）；`adminDbTry` 强制 `requireAdmin` ✓；AI 模型 CRUD 密钥不出后端 ✓；匿名 API 注册表无意外暴露 ✓；`systemApis.logout` 撤销全部会话（受 [[sec.auth-cache-staleness]] 缓存延迟影响）；`TokenGrantService` 并发防重（updateMany 原子占用）✓。
+ - 第五轮补遗（taskApi 其余部分）：生图参数校验完整（count/size 白名单、prompt 限长）✓；`selectAndDownloadImage` 下载 `redirect: 'error'` + 50MB 双重上限 ✓。SSRF 校验缺口备忘：`validateImageUrl` 只对 hostname 字符串做正则（[taskApi.ts](apps/backend/src/api/authApi/taskApi.ts)），`http://2130706433/`（十进制 IP）、`http://0x7f000001/`、以及公网域名解析到内网 IP（DNS rebinding）均可绕过；部署机内网无其他管理面时利用价值有限，记录备查。
+ - 第六轮（paymentApi/tokenApi/wechat.adapter/github-proxy/projects 注册表/dbQueue）结论：后端支付与代币查询面干净——管理接口全部 `requireAdmin`/`adminDbTry` ✓；`savePaymentConfig` 序列化写盘无注入 ✓；微信好友支付走人工确认（无 webhook）✓；`github-proxy` 仅对硬编码 github 域名走代理、无用户输入 SSRF ✓；`projects/` 为构建期生成静态导入 ✓；无 eval/child_process 危险调用 ✓。小瑕疵：`getPublicContactInfo` 注释写"无需登录"但注册在需鉴权的 `/api` 下，注释与路由不符（无安全问题）。后端主面已扫完，后续轮次转向前端 XSS 面与 schema 细读。
+ - 第七轮（schema.zmodel 全文 + rpc/index.ts）补遗：RPC 层有原型污染黑名单（forbiddenProps）+ 白名单机制 ✓；`User @@allow('update', auth() == this)` 允许改自己 email 且无新邮箱验证——若邮箱承担身份语义需评估（低）；**`File` 模型策略只有 `read,create,delete` 没有 update**（第 279 行），而 `fileApi.updateFileStatus` 用带策略的 `auth.db.file.update`——普通用户改文件为 public 可能恒被拒（疑似功能 bug 而非漏洞，请 gs 确认前端公开分享实际走哪条路径）；`GroupStatDaily` 无策略默认全拒，仅内部使用 ✓。
+ - CORS 默认 `origin: true`（[server/index.ts](apps/backend/src/server/index.ts)）：鉴权走 `x-token-id` 头且 `credentials:false`，无 CSRF 面CSRF不成立，但生产未配白名单时任意站点可调用匿名接口；已有启动警告，建议部署检查项强制白名单。
+ - CSP `style-src 'unsafe-inline'`：Vue 运行时模板需要，接受；若迁移编译期模板可收紧。
+ - `oauthStates` / `mergeTickets` / 登录失败计数 / 限流均为进程内存态：**单实例部署假设**。水平扩容时 state 校验跨实例失败（登录不可用，属可用性而非越权）。记录为架构约束。
+ - `handleCause` 对未知错误直接返回 `String(error).split('\n')[0]`：内部错误消息可能外泄（含 SQL 片段的 ORM 错误已单独映射，但自定义 Error 的 message 原样出网）。留意新增错误类型时不要携带敏感细节。
+ - `register` 无验证码，可批量注册空账号（配合上条限流一起处理）。
+ - 微信回调签名比较 `sha1 === signature` 非恒定时间（[WechatService.ts](apps/backend/src/services/WechatService.ts)）：远程时序噪声下实际不可利用，改用 `timingSafeEqual` 属顺手加固。
+ - 支付 webhook 无重放保护（签名不含时间戳）：发货幂等（PAID 跳过）已挡住重复发货，风险低，记录备查。
```

## 新增：[需求以 `## 标题` 为块单位，正文自由描述，`` 双链绑定代码，](示例需求.md)

- 块 ID: `示例需求.md#锚点`

```diff
+ 需求以 `## 标题 [[锚点]]` 为块单位，正文自由描述，`[[...]]` 双链绑定代码，
+ `### 验收` 下的 `- ` 清单是验收条件。
```

## 新增：[示例需求](示例需求.md)

- 块 ID: `示例需求.md#sample.rule`

```diff
+ 这里写需求正文：什么场景下代码必须怎么做。
+
+ 实现：[[src/example.ts#doSomething]]
+ 测试：[[tests/example.test.ts]]
+ ### 验收
+ - 行为符合需求描述
+ - 测试覆盖需求场景
```

## 用户修改：[effect.layer-trunk](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.layer-trunk`

```diff
+
```

## 用户修改：[effect.tagged-errors](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.tagged-errors`

```diff
+
```

## 用户修改：[effect.fiber-timers](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.fiber-timers`

```diff
+
```

## 用户修改：[effect.cache-module](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.cache-module`

```diff
+
+
```

## 用户修改：[effect.queue-lock-renewal](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.queue-lock-renewal`

```diff
+
```

## 用户修改：[effect.api-style-unify](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.api-style-unify`

```diff
+
```

## 用户修改：[effect.wechat-service-v4](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.wechat-service-v4`

```diff
+
```

## 用户修改：[effect.token-cleanup-v4](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.token-cleanup-v4`

```diff
+
```

## 用户修改：[effect.fetchjson-common](effect-v4-精致化改造.md)

- 块 ID: `effect-v4-精致化改造.md#effect.fetchjson-common`

```diff
+
```

## 用户修改：[需求笔记](index.md)

- 块 ID: `index.md#需求笔记`

```diff
+ - [安全审查](安全审查.md) — 持续安全审计：已发现的漏洞与待修复项（只记录，修复时逐块 done）
```
