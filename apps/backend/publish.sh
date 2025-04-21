rsync -avz --progress ./dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/
rsync -avz --progress ../admin-console/dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/frontend/
rsync -avz --progress ./prisma/dev.db admin@47.236.87.38:/home/admin/app/TsFullStack/prisma/
# 先清空uploads目录
ssh -t admin@47.236.87.38 rm -rf /home/admin/app/TsFullStack/uploads/*
# 再上传uploads目录中的文件
rsync -avz --progress ./uploads/* admin@47.236.87.38:/home/admin/app/TsFullStack/uploads/

ssh -t admin@47.236.87.38 pm2 reload TsFullStack
