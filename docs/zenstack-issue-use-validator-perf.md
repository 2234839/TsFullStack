# ZenStack Upstream Issue: `$use()` / `$setAuth()` forces a fresh `InputValidator`, recompiling zod schemas on every derived client

> 目标仓库：[zenstackhq/zenstack](https://github.com/zenstackhq/zenstack)
> 影响版本：`@zenstackhq/orm@3.9.8`（master 同样存在）
> 建议形式：Issue（附 fix 建议），或直接 PR

---

## Title (suggested)

`$use()` and `$setAuth()` create a new `InputValidator` per derived client — first query on each derived client pays 20–50ms of zod schema recompilation

## Summary

Deriving a client with `db.$use(plugin)` or `db.$setAuth(user)` is the documented pattern for per-request clients (per-user policy enforcement). However, each derivation forces `new InputValidator(newClient, ...)`, whose `ZodSchemaFactory` keeps its zod `schemaCache` **as an instance field**. Since compiled schemas depend only on `$schema` (immutable per process), every derived client restarts with a cold cache, so the **first query through every derived client recompiles the model's zod schemas — measured 22–54ms per query** (vs ~2ms warm, vs ~0.1ms raw SQLite).

## Reproduction (better-sqlite3, schema with ~20 models, User has 2 relations)

```ts
const raw = new ZenStackClient(schema, { dialect: new SqliteDialect({ database }) }).$use(new SoftDeletePlugin());

const args = { where: { id: 'nonexist' }, include: { role: true, userSession: { where: { expiresAt: { gt: iso } } } } };

// 1) reuse validator across derivations → warm
const c = raw.$use(noopPlugin);
c.inputValidator = (raw as any).inputValidator; // manual share (the workaround)
await c.user.findFirst(args); // warm-up
await c.user.findFirst(args); // ~2ms

// 2) default behavior: fresh validator per derivation
const d = raw.$use(noopPlugin); // default: new InputValidator
await d.user.findFirst(args); // 22–54ms  ← every derived client

// Isolation experiment (hot client + cold validator, only variable swapped):
// same client object, swap in a fresh InputValidator right before the query
// → 37ms, 54ms, 22ms. Attribute: the validator's cold per-instance zod cache.
```

Real-world trace (production app, per-request `db.$use(costLogger).$use(new PolicyPlugin()).$setAuth(user)`): every authenticated request's first SQL (auth lookup `user.findFirst`) consistently 30–60ms, while the identical SQL on the shared base client is ~2ms. Total request latency dropped from ~35ms to ~3ms after sharing the validator.

## Root cause

`packages/orm/src/client/client-impl.ts`:

```ts
// constructor already inherits the parent's validator:
this.inputValidator = baseClient?.inputValidator
    ?? new InputValidator(this as any, { enabled: this.$options.validateInput !== false });

// but $use/$setAuth/$unuse/$unuseAll all force a new one:
$use(plugin: AnyPlugin) {
    const newClient = new ClientImpl(this.schema, newOptions, this);
    newClient.inputValidator = new InputValidator(newClient as any, { ... });  // ← forced
    return newClient;
}
```

And in `zod/factory.ts`, `ZodSchemaFactory` holds `schemaCache = new Map()` per instance. The compiled zod schemas are a pure function of `client.$schema` (+ validation attributes), not of plugins or auth, so an instance-scoped cache cannot be reused across derived clients.

Sharing appears safe because `ZodSchemaFactory` only reads `$schema` and `$options` from the client reference; `InputValidator.enabled` derives from `validateInput`. The constructor's `baseClient?.inputValidator ?? new ...` line shows inheritance is already the intended semantics for internal derivations.

## Suggested fix

In `$use` / `$setAuth` / `$unuse` / `$unuseAll`, reuse the current client's validator when input-validation options are unchanged:

```ts
$use(plugin: AnyPlugin) {
    const newClient = new ClientImpl(this.schema, newOptions, this);
    if (newOptions.validateInput === this.$options.validateInput) {
        newClient.inputValidator = this.inputValidator;
    } else {
        newClient.inputValidator = new InputValidator(newClient as any, {
            enabled: newOptions.validateInput !== false,
        });
    }
    return newClient;
}
```

(Alternatively/additionally: make the zod schema cache static per `$schema` — larger change but removes the class of problem entirely.)

## Workaround for affected users

```ts
const derived = base.$use(plugin);
(derived as any).inputValidator = (base as any).inputValidator;
```

Caveat: only valid when `validateInput` option is identical between base and derived.

## Why this likely went unnoticed

- Typical quickstart usage derives clients once at startup; the 20–50ms is paid once during boot and invisible.
- The cost appears on the _first query_ of the derived client, so profilers attribute it to "slow SQL" rather than client derivation (we initially misattributed it to SQLite ourselves).
- Existing perf issues in the tracker are all SQL-generation level (EXISTS vs COUNT subqueries, policy index usage), none about client derivation overhead.

## Environment

- `@zenstackhq/orm@3.9.8`, `better-sqlite3@13.0.3`, Node v24.3.0
- Schema: ~20 models; `User` model with `role` (m-n) and `userSession` (1-n) relations, `@email`/`@regex` validation attributes present

---

## 提交前自查（中文备注，不进 issue 正文）

- [ ] 数字均为本机实测，环境写明；他机绝对值会不同，但量级（冷验证 10×+ 慢于热验证）稳定
- [ ] 措辞已避免断言「官方错误」，只陈述证据 + 建议（`$use` 强制新建可能是历史遗留，构造函数的继承语义是判据）
- [ ] 若官方回复说强制新建有隐藏原因（如未来 validator 要感知 plugins），workaround 注明的 caveat 已覆盖差异场景
- [ ] 建议先提 Issue 带数据，等 maintainer（ymc9）回应后再决定是否直接 PR，避免 PR 方向和他们的规划冲突
