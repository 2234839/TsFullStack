## TODO 现在有些 目录/文件 还需要用户手动在服务器上先创建，以后想办法优化
# 同步代码文件
rsync -avz --progress ./dist/* root@47.236.134.32:/root/app/TsFullStack/dist/
rsync -avz --progress ../website-frontend/dist/* root@47.236.134.32:/root/app/TsFullStack/dist/frontend/

# 同步数据库迁移文件
rsync -avz --progress ./prisma/migrations/* root@47.236.134.32:/root/app/TsFullStack/prisma/migrations/
# 同步数据库模型
rsync -avz --progress ./prisma/schema.prisma root@47.236.134.32:/root/app/TsFullStack/prisma/
# 同步数据库引擎
rsync -avz --progress ./node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node  root@47.236.134.32:/root/app/TsFullStack/
# 在项目目录中运行数据库迁移命令,需要在服务端安装 `pnpm i -D prisma`
ssh -t root@47.236.134.32 "cd /root/app/TsFullStack/ && pnpm prisma migrate deploy"

# === 直接用本地数据覆盖服务器数据，数据无价！谨慎操作！！ ===
# 直接同步数据库文件是不安全的，建议使用数据库迁移工具进行迁移
# rsync -avz --progress ./prisma/dev.db root@47.236.134.32:/root/app/TsFullStack/prisma/
# # 先清空uploads目录
# ssh -t root@47.236.134.32 rm -rf /root/app/TsFullStack/uploads/*
# # 再上传uploads目录中的文件
# rsync -avz --progress ./uploads/* root@47.236.134.32:/root/app/TsFullStack/uploads/


# 重启服务器上的应用
ssh -t root@47.236.134.32 pm2 reload TsFullStack
