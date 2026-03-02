-- Migration: 20260302_add_nickname
-- Description: 为 User 表添加 nickname 字段

-- AlterTable
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
