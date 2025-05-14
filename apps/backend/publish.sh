# 同步代码文件
rsync -avz --progress ./dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/
rsync -avz --progress ../admin-console/dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/frontend/


# 同步数据库迁移文件
rsync -avz --progress ./prisma/migrations/* admin@47.236.87.38:/home/admin/app/TsFullStack/prisma/migrations/
# 在项目目录中运行数据库迁移命令,需要在服务端安装 `pnpm i -D prisma`
ssh -t admin@47.236.87.38 "cd /home/admin/app/TsFullStack/ && prisma migrate deploy"


# === 直接用本地数据覆盖服务器数据，数据无价！谨慎操作！！ ===
# 直接同步数据库文件是不安全的，建议使用数据库迁移工具进行迁移
# rsync -avz --progress ./prisma/dev.db admin@47.236.87.38:/home/admin/app/TsFullStack/prisma/
# # 先清空uploads目录
# ssh -t admin@47.236.87.38 rm -rf /home/admin/app/TsFullStack/uploads/*
# # 再上传uploads目录中的文件
# rsync -avz --progress ./uploads/* admin@47.236.87.38:/home/admin/app/TsFullStack/uploads/


# 重启服务器上的应用
ssh -t admin@47.236.87.38 pm2 reload TsFullStack
