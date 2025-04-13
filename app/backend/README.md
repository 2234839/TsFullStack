# 后端

pnpm zenstack generate ./
这个命令将会自动运行 prisma generate (生成 @prisma/client)

pnpm zenstack repl

pnpm prisma generate
pnpm prisma migrate dev
<!-- 将应用部署到集成环境 -->
pnpm prisma migrate deploy

pnpm prisma studio --schema=./prisma/schema.prisma

pnpm tsup && node dist/test.js