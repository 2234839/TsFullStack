# 后端

## 修改数据模型

修改 shcema.zmodel 文件后需要运行以下命令

```bash
# 这个命令将会自动运行 prisma generate (生成 prisma/client 代码)
pnpm zenstack generate
# 迁移数据库为修改后的模型
pnpm prisma migrate dev
```

pnpm zenstack repl

<!-- 将应用部署到集成环境 -->

pnpm prisma migrate deploy

pnpm prisma studio

<!-- 不知道为什么我现在无法打开这个 -->

pnpm tsup && node dist/test.js

## 注意

需要使用这种命令来允许build，尤其是在服务器上 使用时，不然就没法使用或者在 package.json中配置 pnpm.onlyBuiltDependencies : [ "better-sqlite3" ]

`pnpm add better-sqlite3 --allow-build=better-sqlite3`

记得执行 `pnpm rebuild`

无法使用 tsx 直接运行 zenstack，需要 ts-node 或者 tsup 编译后运行 js
