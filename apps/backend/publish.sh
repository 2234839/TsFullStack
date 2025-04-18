rsync -avz --progress ./dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/
rsync -avz --progress ../admin-panel/dist/* admin@47.236.87.38:/home/admin/app/TsFullStack/frontend/
rsync -avz --progress ./prisma/dev.db admin@47.236.87.38:/home/admin/app/TsFullStack/prisma/

ssh -t admin@47.236.87.38 pm2 reload TsFullStack
