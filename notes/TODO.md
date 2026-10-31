# TODO

> 由 `pact todo` 生成，勿手改。按 diff 组织：每块只列差异行（+ 新 / - 旧），实现后 `pact todo --done <块ID>` 标记完成。已删除的块用 `pact todo --clean <块ID>` 清理记录。共 36 项待办。

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

## 新增：[持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。](安全审查.md)

- 块 ID: `安全审查.md#持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。`

```diff
+ 持续安全审计记录：每块是一个待修复的安全发现（只记录、不改代码）。按严重度排列，修复后逐块 `pact todo --done` 并回填实现链接。
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
+ - 第八轮（前端 XSS 面）结论：全仓 `v-html` 仅 [Img2Svg.vue](apps/website-frontend/src/components/Img2Svg.vue)（程序化生成，无外部输入 ✓）与 InfoFlow 的 [ExecutionDetails.vue](apps/InfoFlow/components/ExecutionDetails.vue) 两处；`window.open` 全带 noopener ✓。InfoFlow 观察备查：`host_permissions: ['<all_urls>']` + `tabs`/`activeTab` 是高权限组合（产品功能所需，采集任意网页）；content.ts 的 `new Function` 执行的 `method.code` 来自扩展自身规则存储（`browser.tabs.sendMessage` 仅扩展内部可发，无 externally_connectable），等同用户脚本管理器语义，非漏洞。但 ExecutionDetails.vue 用 `v-html` 渲染**采集到的外部网页 HTML 片段**（`el.outerHTML`），恶意网页可内嵌 `<img onerror>` 等载荷进入扩展 UI：MV3 默认 CSP（`script-src 'self'`）会挡住扩展页面里的内联执行，content script 侧即便执行也在页面自身 origin（页面本就对自己有权），实际可利用性低——属「防御纵深」项，建议改用文本化渲染。
+ - 第九轮（WechatService / GroupEntryService / shared-frontend utils / groupEntry 路由）结论：群码落地页 `escapeHtml` 覆盖全部插值 ✓、`resolveImagePath` 路径穿越防御 ✓、MIME 白名单+5MB 上限 ✓、管理路由统一 `guard`（x-admin-token，弱值禁用）✓；shared-frontend utils 无安全敏感面 ✓。备忘三条：① `verifyWechatSignature` 的 `sha1 === signature` 非恒定时间（前已记）；② `buildTextReplyXml`/`buildImageReplyXml` 的 toUser/fromUser/mediaId 直接进 CDATA 无 `]]>` 逃逸防护——来源是已验签的微信回调与服务端数据，可利用性≈0，但若未来接入未验签数据源需先补；③ WechatService 的伴生注册表 `replyCacheBuilders`/`mediaCacheKeys`（[WechatService.ts](apps/backend/src/services/WechatService.ts)）只增不减，Cache 有 capacity 但伴生 Map 无上限，长期运行无限 openid×msgId 组合会缓慢泄漏内存（可用性，非越权）。另 `GroupEntryService.recordStat` 公开埋点无防刷，pageUv 仅靠 cookie，脚本可污染统计数据（低）。
+ - 第十二轮（shareCrypto/dbQueue/infoQuality/useFileUrl）结论：shareCrypto 密码学实现正确（PBKDF2 100k + AES-GCM 随机 IV + getRandomValues ✓，见独立块 [[sec.share-password-in-history]] 的 hash 写回问题）；dbQueue 任务领取/完成/失败恢复全程校验 `workerId === instanceId` 防跨实例误操作 ✓；useFileUrl 干净 ✓。备忘两条：① `generateRandomPassword`（[shareCrypto.ts](apps/website-frontend/src/utils/shareCrypto.ts)）`charset[val % 62]` 有取模偏差（256 % 62 = 8，前 8 个字符概率高 ~1.6%），16 字符下熵仍 >94 bits，实际影响可忽略，改 rejection sampling 属顺手加固；② `evaluateInfoQuality`（[infoQuality.ts](apps/backend/src/api/AiApi/infoQuality.ts)）注册在需登录的 `/api` 层且**无任何限速**，登录用户可无限调用自托管 Ollama 消耗算力（与 [[sec.ai-proxy-no-cost]] 同类，`model` 参数仅进 JSON body 无 SSRF 面，5000 字符上限 ✓，prompt 注入防护尽力而为、后果仅判定翻转，均低）。
+ - 第十三轮（前端 utils / DataBaseStudio / webhook / wechat 路由收尾）结论：全干净。`searchUsers` 走 `API.db.user.findMany` 但 User read 策略是 `auth() == this`，非管理员只能查到自己 ✓；webhook 路由无额外逻辑（验签在 PaymentService 已审 ✓）；wechat 路由全流程验签前置 ✓，指令图片经 `downloadMediaImage` 下载后复用 `uploadQr`/`uploadOfficialQr` 入库，MIME 白名单（png/jpeg/webp，SVG 被拒）+ 5MB 上限生效 ✓——无「恶意 SVG 直出成同源 XSS」的路径；`getResourceUrl` 的 `metadata.externalUrl` 直出 URL 仅作 img src/下载地址使用，无 `<a href>` 注入点（低，留意未来用法）。后端 server 目录至此全部审完。
+ - 第十四轮（前端残余危险 API 面收尾）结论：全干净。全前端无 postMessage/srcdoc/document.cookie/insertAdjacentHTML/DOMParser 使用；`window.open` 全部 noopener 或硬编码 URL；各 `:href` 绑定源均为本地 blob/data URL、签名 API URL 或硬编码外链；ShareForm 加密分享的提交 payload 只含 `{encrypted, 密文, salt}`，**密码确实不出客户端**，与安全模型一致 ✓。主审查面（后端全部 + 前端高危面 + InfoFlow 扩展 + shared-frontend）至此系统扫完，共 17 块发现（2 高、2 中高、7 中/中低、6 低）+ 备忘。后续轮次转为巡检模式：优先审 git 新改动，无改动则 noop。
+ - 登录重定向发现见独立块 [[sec.login-open-redirect]]（第八轮主发现）。
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
+ - [架构切割面审查](架构切割面审查.md) — 全仓「应有抽象层但缺失」清单：分页/配置写入/错误提示样板等，按重复度×风险排序
```

## 用户修改：[会话令牌与口令轮询票据使用 cuid2 生成，熵源是 Math.random 而非 CSPRNG](安全审查.md)

- 块 ID: `安全审查.md#sec.session-token-cuid`

```diff
- 两处安全敏感字段都用 `@default(cuid())`（[schema.zmodel](apps/backend/schema.zmodel)）：
+ > 两处安全敏感字段都用 `@default(cuid())`（[schema.zmodel](apps/backend/schema.zmodel)）：
+ ### 验收
+ - UserSession.token 与 VerificationPasscode.ticket 不再由 cuid 生成，改用 crypto 随机源
+ - 存量令牌无需迁移脚本即可平滑过渡
```

## 用户修改：[鉴权用户缓存 10 分钟，会话撤销/禁用密码登录延迟生效](安全审查.md)

- 块 ID: `安全审查.md#sec.auth-cache-staleness`

```diff
- [authCache.ts](apps/backend/src/server/authCache.ts) 的 `userCache` TTL 10 分钟，key 含 sessionToken/sessionID。`getDbAuthEffect` 查询本身校验 `expiresAt > now`（[DbService.ts](apps/backend/src/Context/DbService.ts)），但命中缓存后不再查库，导致：
+ > [authCache.ts](apps/backend/src/server/authCache.ts) 的 `userCache` TTL 10 分钟，key 含 sessionToken/sessionID。`getDbAuthEffect` 查询本身校验 `expiresAt > now`（[DbService.ts](apps/backend/src/Context/DbService.ts)），但命中缓存后不再查库，导致：
+ ### 验收
+ - 会话删除/用户状态变更后，该会话的后续鉴权请求立即（或秒级）失效
+ - 可用 Cache.invalidate 按精确 key 失效，或缩短敏感场景 TTL
```

## 用户修改：[GET 签名认证：签名只覆盖 args，不含方法名，且无时效可永久重放](安全审查.md)

- 块 ID: `安全审查.md#sec.get-sign-no-binding`

```diff
- [server/index.ts](apps/backend/src/server/index.ts) 的 `parseParamsAndAuth`：GET 请求用 `?session=<id>&sign=<hex>` 认证，`verifySignByToken(query.args, session.token, sign)` 只对 **args 字符串** 做 HMAC（[SessionAuthSign.ts](apps/backend/src/lib/SessionAuthSign.ts)）。问题：
+ > [server/index.ts](apps/backend/src/server/index.ts) 的 `parseParamsAndAuth`：GET 请求用 `?session=<id>&sign=<hex>` 认证，`verifySignByToken(query.args, session.token, sign)` 只对 **args 字符串** 做 HMAC（[SessionAuthSign.ts](apps/backend/src/lib/SessionAuthSign.ts)）。问题：
+ ### 验收
+ - 签名校验的输入包含 RPC 方法名与参数，跨方法不可复用
+ - 签名带有效期，过期拒绝
```

## 用户修改：[密码爆破防护仅账号维度递增延迟，无 IP 维度限制](安全审查.md)

- 块 ID: `安全审查.md#sec.bruteforce-account-only`

```diff
- [auth.ts](apps/backend/src/api/appApi/auth.ts) 的失败延迟按 email 计数（Cache 10 分钟 TTL，封顶 5 秒）。攻击者对单账号可持续每 ~5 秒试一次且无锁定上限；换 IP/分布式对多账号喷洒时每账号独立计数，防护趋近于零。`mergeIntoAccount`、`setPasswordLoginDisabled`、`verifyByEmailPwd` 各自的 randomDelay(500-1000ms) 同样只是固定限速。
+ > [auth.ts](apps/backend/src/api/appApi/auth.ts) 的失败延迟按 email 计数（Cache 10 分钟 TTL，封顶 5 秒）。攻击者对单账号可持续每 ~5 秒试一次且无锁定上限；换 IP/分布式对多账号喷洒时每账号独立计数，防护趋近于零。`mergeIntoAccount`、`setPasswordLoginDisabled`、`verifyByEmailPwd` 各自的 randomDelay(500-1000ms) 同样只是固定限速。
+ ### 验收
+ - 同 IP 高频密码失败触发封禁/验证码
+ - 单账号失败有累计上限（不止延迟递增）
```

## 用户修改：[登录响应时序差异泄露邮箱注册状态](安全审查.md)

- 块 ID: `安全审查.md#sec.login-timing-enumeration`

```diff
- [auth.ts](apps/backend/src/api/appApi/auth.ts)：`!user || !(yield* comparePassword(password, user.password))` 短路求值——用户不存在时跳过 bcrypt compare（约 100ms），与「用户存在但密码错」响应时序不同，可枚举已注册邮箱。失败延迟对两条路径相同，无法抵消 bcrypt 时长差。
+ > [auth.ts](apps/backend/src/api/appApi/auth.ts)：`!user || !(yield* comparePassword(password, user.password))` 短路求值——用户不存在时跳过 bcrypt compare（约 100ms），与「用户存在但密码错」响应时序不同，可枚举已注册邮箱。失败延迟对两条路径相同，无法抵消 bcrypt 时长差。
+ ### 验收
+ - 用户不存在与密码错误两条路径的响应耗时统计上不可区分
```

## 用户修改：[全局口令验证封禁可被恶意触发，DoS 全站口令登录](安全审查.md)

- 块 ID: `安全审查.md#sec.global-verify-ban-dos`

```diff
- [PasscodeService.ts](apps/backend/src/services/PasscodeService.ts) `verify` 的 `globalKey = 'verify:global'` 失败 10 次/10 分钟即封禁**所有人**的微信口令登录 5 分钟。攻击者向公众号随意发 10 个错误 code 即可周期性拒绝全部用户口令登录。单身份封禁是必要的，全局封禁把可用性交给了攻击者。
+ > [PasscodeService.ts](apps/backend/src/services/PasscodeService.ts) `verify` 的 `globalKey = 'verify:global'` 失败 10 次/10 分钟即封禁**所有人**的微信口令登录 5 分钟。攻击者向公众号随意发 10 个错误 code 即可周期性拒绝全部用户口令登录。单身份封禁是必要的，全局封禁把可用性交给了攻击者。
+ ### 验收
+ - 攻击者无法通过少量失败请求阻塞其他正常用户的口令验证
```

## 用户修改：[匿名口令创建接口无速率限制，可灌库](安全审查.md)

- 块 ID: `安全审查.md#sec.passcode-create-nolimit`

```diff
- `passcodeApi.createWechatLogin / createWechatMergeVerify`（app-api 匿名）每次调用执行一条 `deleteMany(过期)` + 一条 `create`，无任何限流/Captcha。脚本可高频调用造成 SQLite 写放大与表膨胀（虽然有过期清理，但清理只删已过期记录，持续高频创建会持续占用写吞吐）。
+ > `passcodeApi.createWechatLogin / createWechatMergeVerify`（app-api 匿名）每次调用执行一条 `deleteMany(过期)` + 一条 `create`，无任何限流/Captcha。脚本可高频调用造成 SQLite 写放大与表膨胀（虽然有过期清理，但清理只删已过期记录，持续高频创建会持续占用写吞吐）。
+ ### 验收
+ - 匿名创建口令接口有按 IP 的速率上限
```

## 用户修改：[支付发货前不校验回调金额，MBD 与爱发电金额单位还不一致](安全审查.md)

- 块 ID: `安全审查.md#sec.payment-amount-unchecked`

```diff
- [PaymentService.ts](apps/backend/src/services/payment/PaymentService.ts) `handleWebhook`：回调验签通过且 `paymentStatus === 'success'` 即标记 PAID 并发代币，**从不比较 `parsed.paidAmount` 与订单应付金额**（`order.amount`，单位为分，见 [schema.zmodel](apps/backend/schema.zmodel) 的 `price（分）`）。
+ > [PaymentService.ts](apps/backend/src/services/payment/PaymentService.ts) `handleWebhook`：回调验签通过且 `paymentStatus === 'success'` 即标记 PAID 并发代币，**从不比较 `parsed.paidAmount` 与订单应付金额**（`order.amount`，单位为分，见 [schema.zmodel](apps/backend/schema.zmodel) 的 `price（分）`）。
+ ### 验收
+ - 发货前校验 `paidAmount >= order.amount`，不足时拒绝发货并记录告警日志
+ - 两个渠道的 paidAmount 落库单位统一为分，且有注释说明
```

## 用户修改：[文件上传无用户配额，注册账号可耗尽存储](安全审查.md)

- 块 ID: `安全审查.md#sec.upload-no-quota`

```diff
- [file.ts](apps/backend/src/api/authApi/file.ts) `upload`：单文件上限 1GB（`MAX_UPLOAD_BYTES`），但无每用户总容量/文件数配额，且注册无门槛（无验证码）。脚本注册账号后循环上传 1GB 文件即可耗尽服务器磁盘，影响全站可用性（SQLite 同盘写入也会受牵连）。
+ > [file.ts](apps/backend/src/api/authApi/file.ts) `upload`：单文件上限 1GB（`MAX_UPLOAD_BYTES`），但无每用户总容量/文件数配额，且注册无门槛（无验证码）。脚本注册账号后循环上传 1GB 文件即可耗尽服务器磁盘，影响全站可用性（SQLite 同盘写入也会受牵连）。
+ ### 验收
+ - 单用户存储总量有上限，超限上传被拒绝
+ - 匿名/新注册账号的滥用成本显著提高
```

## 用户修改：[分享详情接口保留自增 id 查询，UUID 防枚举被兼容逻辑绕过](安全审查.md)

- 块 ID: `安全审查.md#sec.share-legacy-id-enumerable`

```diff
- [share.ts](apps/backend/src/api/appApi/share.ts) `detail(idOrKey)`：新链接是不可预测的 UUID key，但纯数字时直接按自增 `id` 查询（注释自述"兼容旧版存量分享不失效"）。自增 id 可被遍历（`id=1,2,3…`），匿名即可枚举拉取**所有**用户的分享内容——UUID 的防枚举设计被这一条 OR 分支整体绕过。
+ > [share.ts](apps/backend/src/api/appApi/share.ts) `detail(idOrKey)`：新链接是不可预测的 UUID key，但纯数字时直接按自增 `id` 查询（注释自述"兼容旧版存量分享不失效"）。自增 id 可被遍历（`id=1,2,3…`），匿名即可枚举拉取**所有**用户的分享内容——UUID 的防枚举设计被这一条 OR 分支整体绕过。
+ ### 验收
+ - 无法通过遍历数字 id 获取非自己创建的分享
+ - 存量分享链接有迁移方案（跳转或失效）
```

## 用户修改：[OAuth login/merge 意图不绑定发起会话，存在登录 CSRF 面](安全审查.md)

- 块 ID: `安全审查.md#sec.oauth-login-csrf`

```diff
- OAuth state 已做一次性+过期校验，bind 意图还校验了 `initiatorUserId === 当前会话`（[github.ts](apps/backend/src/api/appApi/github.ts) 第 74-80 行，正确）。但：
+ > OAuth state 已做一次性+过期校验，bind 意图还校验了 `initiatorUserId === 当前会话`（[github.ts](apps/backend/src/api/appApi/github.ts) 第 74-80 行，正确）。但：
+ ### 验收
+ - OAuth 回调校验发起浏览器身份（nonce cookie 或等价机制）
+ - login CSRF 攻击路径不可行
```

## 用户修改：[AI 代理接口登录即可用且不扣代币，注册无门槛可白嫖 LLM 额度](安全审查.md)

- 块 ID: `安全审查.md#sec.ai-proxy-no-cost`

```diff
- > 决策（2026-10-31）：与设计意图对齐——免费代理是有意为之，保持现状不扣费。已有 IP/用户/模型三维限速兜底，不动代码。
-
+ > 决策（2026-10-31 二次拍板）：免费代理收窄为白名单制——AiModel 新增 `freeForLoginUser` 标注（默认 false），只有后台标注「登录用户免费可用」的模型才可通过 proxyOpenAI 调用，未标注一律拒绝（提示无可用模型）。实现见 [schema.zmodel](../apps/backend/schema.zmodel)、[AIProxyService.ts](../apps/backend/src/Context/AIProxyService.ts)（按标注过滤后再负载均衡）、[AiApi/index.ts](../apps/backend/src/api/AiApi/index.ts)、[AiModelForm.vue](../apps/website-frontend/src/pages/admin/components/AiModelForm.vue)、[AiModelManager.vue](../apps/website-frontend/src/pages/admin/AiModelManager.vue)；迁移 20261031180000。存量模型默认全部不开放，需管理员在后台逐个打开。
+ ### 验收
+ - proxyOpenAI 消耗代币或有等价的成本约束（与设计意图对齐后确认）
+ - 限速维度补充账号年龄/信誉等反滥用因子（可选）
```

## 用户修改：[AI 生图先出图后扣费，无余额账号可反复触发真实 AI 调用产生坏账](安全审查.md)

- 块 ID: `安全审查.md#sec.ai-image-pay-after-delivery`

```diff
- [taskApi.ts](apps/backend/src/api/authApi/taskApi.ts) `generateAIImage` 的时序：`createTask`（**不检查余额**，[TaskService.ts](apps/backend/src/services/TaskService.ts) 仅建记录）→ `startTask` → 调用 AI 服务商（真实成本发生）→ `completeTask` → **最后才 `consumeTokens`**（此时才检查余额，失败仅把任务标记 failed）。
+ > [taskApi.ts](apps/backend/src/api/authApi/taskApi.ts) `generateAIImage` 的时序：`createTask`（**不检查余额**，[TaskService.ts](apps/backend/src/services/TaskService.ts) 仅建记录）→ `startTask` → 调用 AI 服务商（真实成本发生）→ `completeTask` → **最后才 `consumeTokens`**（此时才检查余额，失败仅把任务标记 failed）。
+ ### 验收
+ - AI 调用发生前校验并预扣/冻结代币，失败退回
+ - 无余额账号的请求在触达 AI 服务商之前被拒绝
```

## 用户修改：[consumeTokens 并发截断增量导致少扣多发](安全审查.md)

- 块 ID: `安全审查.md#sec.consume-tokens-partial-deduct`

```diff
- [TokenService.ts](apps/backend/src/services/TokenService.ts) `consumeTokens`：余额检查（事务外）→ 事务内重读 `used` 并计算 `actualIncrement = Math.min(expectedIncrement, current.amount - current.used)`，注释意图是"按实际增量防超支"，但**截断后不回滚**——`actualIncrement > 0 但 < expectedIncrement` 时事务照常提交。
+ > [TokenService.ts](apps/backend/src/services/TokenService.ts) `consumeTokens`：余额检查（事务外）→ 事务内重读 `used` 并计算 `actualIncrement = Math.min(expectedIncrement, current.amount - current.used)`，注释意图是"按实际增量防超支"，但**截断后不回滚**——`actualIncrement > 0 但 < expectedIncrement` 时事务照常提交。
+ ### 验收
+ - 并发消耗同一批代币时，任何一笔增量被截断都会整体回滚
+ - 账面消耗总和恒等于实际服务成本
```

## 用户修改：[ZenStack 策略对 Token/Order/Task 开放用户级 create/update，违背最小权限](安全审查.md)

- 块 ID: `安全审查.md#sec.zenstack-overbroad-create`

```diff
- [schema.zmodel](apps/backend/schema.zmodel) 中多个资金/业务敏感模型对 `auth() == user` 开放了写权限：
+ > [schema.zmodel](apps/backend/schema.zmodel) 中多个资金/业务敏感模型对 `auth() == user` 开放了写权限：
+ ### 验收
+ - Token / TokenTransaction / Order / Task 对普通用户只保留 read
+ - 全库 grep 确认无用户输入直达这些模型写操作的路径
```

## 用户修改：[登录成功跳转 r 参数未校验协议与域名，构成 open redirect 与 javascript: DOM XSS](安全审查.md)

- 块 ID: `安全审查.md#sec.login-open-redirect`

```diff
- 调用链：各页面未登录时 `routerUtil.push(routeMap.login, {}, { r: route.fullPath })` 把回跳地址放进 **query**（[index.vue](apps/website-frontend/src/pages/index.vue)、[api.ts](apps/website-frontend/src/api.ts)、[storage/index.ts](apps/website-frontend/src/storage/index.ts)、[AdminLayout.vue](apps/website-frontend/src/pages/admin/AdminLayout.vue) 等）；[routeUtil.ts](packages/shared-frontend/src/utils/routeUtil.ts) 第 117-118 行对未配置 props 的路由自动执行 `props = (route) => ({ ...route.query, ...route.params })`，query 里的 `r` 直接注入 [login.vue](apps/website-frontend/src/pages/login.vue) 的 `r` prop；登录成功后 [loginUtil.ts](apps/website-frontend/src/pages/loginUtil.ts) `loginGoto` 执行 `location.href = decodeURIComponent(options.r)`，**对协议和域名零校验**。OAuth 回调页（[github.vue](apps/website-frontend/src/pages/oauth/github.vue)、[linuxdo.vue](apps/website-frontend/src/pages/oauth/linuxdo.vue)）的 `r` 同样来自 query 注入。
+ > 调用链：各页面未登录时 `routerUtil.push(routeMap.login, {}, { r: route.fullPath })` 把回跳地址放进 **query**（[index.vue](apps/website-frontend/src/pages/index.vue)、[api.ts](apps/website-frontend/src/api.ts)、[storage/index.ts](apps/website-frontend/src/storage/index.ts)、[AdminLayout.vue](apps/website-frontend/src/pages/admin/AdminLayout.vue) 等）；[routeUtil.ts](packages/shared-frontend/src/utils/routeUtil.ts) 第 117-118 行对未配置 props 的路由自动执行 `props = (route) => ({ ...route.query, ...route.params })`，query 里的 `r` 直接注入 [login.vue](apps/website-frontend/src/pages/login.vue) 的 `r` prop；登录成功后 [loginUtil.ts](apps/website-frontend/src/pages/loginUtil.ts) `loginGoto` 执行 `location.href = decodeURIComponent(options.r)`，**对协议和域名零校验**。OAuth 回调页（[github.vue](apps/website-frontend/src/pages/oauth/github.vue)、[linuxdo.vue](apps/website-frontend/src/pages/oauth/linuxdo.vue)）的 `r` 同样来自 query 注入。
+ ### 验收
+ - `?r=` 为外部 URL / `javascript:` / `data:` 时登录后不跳转，走站内默认路径
+ - 站内相对路径（含 `/admin` 等深链）登录后正常回跳
```

## 用户修改：[「记住密码」把明文密码持久化到 localStorage，加密密钥是公开的前端静态常量](安全审查.md)

- 块 ID: `安全审查.md#sec.localstorage-credentials`

```diff
- [storage/index.ts](apps/website-frontend/src/storage/index.ts) 的 `localUserPwd` 在勾选 rememberMe 时把**用户名+密码原文**写入 localStorage（[login.vue](apps/website-frontend/src/pages/login.vue) 第 393-394 行、[AuthCard.vue](apps/website-frontend/src/components/common/AuthCard.vue) 第 156-157 行）。落盘前经过 [encryptSerializer.ts](apps/website-frontend/src/utils/encryptSerializer.ts) 的 AES-GCM 加密，但该文件自述已承认：密钥是构建期静态常量（`VITE_SECRET_KEY` 打进 bundle，全用户共用同一把；未配置时用默认值 `__default_frontend_key__`）。**密钥公开的加密 = 可逆混淆**，不构成机密性。
+ > [storage/index.ts](apps/website-frontend/src/storage/index.ts) 的 `localUserPwd` 在勾选 rememberMe 时把**用户名+密码原文**写入 localStorage（[login.vue](apps/website-frontend/src/pages/login.vue) 第 393-394 行、[AuthCard.vue](apps/website-frontend/src/components/common/AuthCard.vue) 第 156-157 行）。落盘前经过 [encryptSerializer.ts](apps/website-frontend/src/utils/encryptSerializer.ts) 的 AES-GCM 加密，但该文件自述已承认：密钥是构建期静态常量（`VITE_SECRET_KEY` 打进 bundle，全用户共用同一把；未配置时用默认值 `__default_frontend_key__`）。**密钥公开的加密 = 可逆混淆**，不构成机密性。
+ ### 验收
+ - localStorage 中不再出现可解密的用户密码（记住密码功能移除或改为只记用户名）
+ - 登录页对保留的凭据存储方式有明确风险提示（如保留 token 存储）
```

## 用户修改：[加密分享的密码被写回 URL hash，泄露进浏览器历史与云同步](安全审查.md)

- 块 ID: `安全审查.md#sec.share-password-in-history`

```diff
- [ShareEditor.vue](apps/website-frontend/src/pages/share/ShareEditor.vue) 第 310-313 行：用户手动输入密码解锁后，执行 `history.replaceState(null, '', pathname + '#k=<salt>&p=<password>')`，把**密码原文写进 URL hash**（注释自述"使分享链接/二维码自动包含密码"）。
+ > [ShareEditor.vue](apps/website-frontend/src/pages/share/ShareEditor.vue) 第 310-313 行：用户手动输入密码解锁后，执行 `history.replaceState(null, '', pathname + '#k=<salt>&p=<password>')`，把**密码原文写进 URL hash**（注释自述"使分享链接/二维码自动包含密码"）。
+ ### 验收
+ - 浏览器历史中不出现含密码的 URL（不自动写回 hash，或提供"不记住密码"的默认选项）
+ - 若保留链接即钥匙模式，分享 UI 明确告知密码包含在链接里
```
