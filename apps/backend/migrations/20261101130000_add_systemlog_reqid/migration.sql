-- SystemLog.reqId 补迁移：历史提交 355686e 引入了 schema 的 reqId Int? 列但漏建迁移，
-- 线上库一直缺列（行为记录 listBehavior 查询报 no such column）
ALTER TABLE "SystemLog" ADD COLUMN "reqId" INTEGER;
