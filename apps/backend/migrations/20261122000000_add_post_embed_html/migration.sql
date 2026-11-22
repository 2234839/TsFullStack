-- 树洞 HTML 分享：帖子附带静态 HTML 演示文件 ID（经 /embed/:id 沙箱路由输出）
ALTER TABLE "Post" ADD COLUMN "embedHtmlId" INTEGER;
