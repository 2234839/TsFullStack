-- 用户可选禁用账号密码登录（仅渠道登录，类似可信设备授权）
ALTER TABLE `User` ADD COLUMN `passwordLoginDisabled` BOOLEAN NOT NULL DEFAULT false;
