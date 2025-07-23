# 后端

## todo

[] 接入 https://github.com/better-auth/better-auth

## 修改数据模型
修改 shcema.zmodel 文件
然后运行以下命令
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

编译发布
pnpm --filter tsfullstack-backend build:publish

无法使用 tsx 直接运行 zenstack，需要 ts-node 或者 tsup 编译后运行 js