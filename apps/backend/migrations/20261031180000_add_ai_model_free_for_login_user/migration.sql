-- AI 模型加「登录用户免费可用」标注：默认 false（不开放免费代理），管理员按需在后台打开
ALTER TABLE `AiModel` ADD COLUMN `freeForLoginUser` BOOLEAN NOT NULL DEFAULT false;
