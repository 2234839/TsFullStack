# 后端

pnpm zenstack generate
这个命令将会自动运行 prisma generate (生成 @prisma/client)

pnpm zenstack repl

pnpm prisma generate
pnpm prisma migrate dev
<!-- 将应用部署到集成环境 -->
pnpm prisma migrate deploy

pnpm prisma studio
<!-- 不知道为什么我现在无法打开这个 -->

pnpm tsup && node dist/test.js

## 注意

无法使用 tsx 直接运行 zenstack，需要 ts-node 或者 tsup 编译后运行 js