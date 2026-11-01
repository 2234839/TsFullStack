-- SystemLog 行为记录字段补齐：与 reqId 同源（355686e schema 变更漏建迁移），
-- 上一迁移已补 reqId，这里补齐其余缺失列（method/totalMs/error）
ALTER TABLE "SystemLog" ADD COLUMN "method" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "totalMs" INTEGER;
ALTER TABLE "SystemLog" ADD COLUMN "error" BOOLEAN NOT NULL DEFAULT false;
