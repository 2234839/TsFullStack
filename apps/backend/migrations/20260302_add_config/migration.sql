-- Migration: 20260302_add_config
-- Description: 为 AiModel 表添加缺失的 config 字段
-- 注意：线上 AiModel 表已有 modelType 字段，只需要添加 config 字段

ALTER TABLE "AiModel" ADD COLUMN "config" TEXT;
