/**
 * 从 schema.zmodel 生成 prisma-deploy/schema.prisma（部署用）
 *
 * 背景：zenstack CLI（generate/migrate）需要 Node 21+（Object.groupBy），
 * 部署服务器是 Node 20 只能跑 prisma CLI。此脚本在本地把 ZModel 转成
 * prisma schema，publish.sh 随 rsync 推到远端，远端用
 * `prisma migrate deploy --schema ./prisma-deploy/schema.prisma` 应用迁移。
 *
 * 用法：node scripts/gen-prisma-schema.mjs（在 apps/backend 目录下运行）
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const zmodelPath = resolve(backendRoot, "schema.zmodel");

const { PrismaSchemaGenerator } = await import("@zenstackhq/sdk");
const { loadDocument } = await import("@zenstackhq/language");

const loadResult = await loadDocument(zmodelPath, [], true);
if (!loadResult.success) {
  loadResult.errors.forEach((err) => console.error(err));
  throw new Error("schema.zmodel 解析失败");
}
const model = loadResult.model;

const generator = new PrismaSchemaGenerator(model);
const prismaSchema = await generator.generate();

const outDir = resolve(backendRoot, "prisma-deploy");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "schema.prisma"), prismaSchema);
console.log(`✅ prisma schema 已生成: ${outDir}/schema.prisma`);
