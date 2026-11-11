/**
 * 浮空 Effect 检测：找出「返回 Effect 的调用被当作普通语句丢弃」的 bug。
 *
 * 背景（2026-11-11 GitHub OAuth 事故）：github.ts 的 getAuthorizationUrl 里
 * `registerOAuthState(state, ...)` 漏写 `yield*`，Effect 创建后从未执行，
 * state 没登记进 KVStore，回调校验必然失败。TS 对"表达式语句返回值被丢弃"
 * 不报错，且漏掉 yield* 后函数的 Effect 依赖签名反而更"干净"，类型检查直接通过，
 * 所以这类 bug 只能靠运行时暴露。
 *
 * 检测原理：用 TS Compiler API 做类型检查，遍历所有 ExpressionStatement，
 * 判断其表达式类型是否为 Effect.Effect（含 pipe 后的 Effect）。
 * 是 → 说明这个 Effect 没有被 yield*、runPromise 或 Effect.runFork 消费，报告。
 *
 * 用法：pnpm tsx scripts/check-floating-effect.ts（或 vp run check:effect）
 * 退出码：发现浮空 Effect 时为 1，可挂 CI / prebuild。
 */
import ts from 'typescript';
import path from 'path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * 加载带完整 Compiler API 的 typescript：backend 钉的是 TS7（原生编译器，
 * 主入口只有 version，无 ts.sys/createProgram），所以解析到仓库内其他包的
 * TS5/TS6 完整版。找不到时给出明确报错。
 */
function loadTypeScript(): typeof ts {
  const candidates = [
    path.resolve(ROOT, '../website-frontend/node_modules/typescript'),
    path.resolve(ROOT, '../../node_modules/typescript'),
  ];
  const require = createRequire(import.meta.url);
  for (const dir of candidates) {
    try {
      const pkg = require(`${dir}/package.json`) as { version: string };
      if (!pkg.version.startsWith('7')) {
        return require(dir) as typeof ts;
      }
    } catch {
      continue;
    }
  }
  throw new Error('找不到带 Compiler API 的 typescript（TS5/TS6）；backend 钉的 TS7 主入口不导出 ts.sys');
}
const tslib = loadTypeScript();
const ts = tslib;

/** 扫描范围：与 apps/backend/tsconfig.json 的 include 保持一致 */
const INCLUDE = ['src/**/*.ts', 'scripts/**/*.ts'];
/** 排除：测试文件自身不参与扫描 */
const EXCLUDE = ['**/*.test.ts', '**/__tests__/**'];

function loadTsconfig(): ts.ParsedCommandLine {
  const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('找不到 tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
  /** 覆盖 include：只扫后端源码，忽略 tsconfig 里 projects 等大目录 */
  return ts.parseJsonConfigFileContent(
    { ...configFile.config, include: INCLUDE, exclude: [...EXCLUDE, ...(configFile.config.exclude ?? [])] },
    ts.sys,
    ROOT,
  );
}

/** 判断类型是否为 Effect（Effect.Effect<...> 及其别名/pipe 结果） */
function isEffectType(type: ts.Type, checker: ts.TypeChecker, depth = 0): boolean {
  if (depth > 10) return false;
  const target = type.isUnion() ? type.types : [type];
  for (const t of target) {
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) continue;
    const symbol = t.aliasSymbol ?? t.getSymbol();
    if (!symbol) continue;
    const name = symbol.getName();
    if (name === 'Effect') return true;
    /** 展开一层类型别名（type MyEffect = Effect.Effect<...>） */
    if (t.aliasSymbol && t.aliasTypeArguments) {
      for (const arg of t.aliasTypeArguments) {
        if (isEffectType(arg, checker, depth + 1)) return true;
      }
    }
    /** 展开一层泛型实例的 typeArguments（如 Effect.Effect<A, E, R> 本体） */
    const typeArgs = (t as ts.TypeReference).typeArguments;
    if (typeArgs) {
      for (const arg of typeArgs) {
        if (isEffectType(arg, checker, depth + 1)) return true;
      }
    }
  }
  return false;
}

function main(): void {
  const config = loadTsconfig();
  const program = ts.createProgram(config.fileNames, config.options);
  const checker = program.getTypeChecker();
  const diagnostics = program.getSemanticDiagnostics();

  const problems: string[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const rel = path.relative(ROOT, sourceFile.fileName);
    /** 只扫项目内文件（排除 node_modules） */
    if (rel.startsWith('..') || rel.includes('node_modules')) continue;

    const visit = (node: ts.Node): void => {
      if (ts.isExpressionStatement(node)) {
        const type = checker.getTypeAtLocation(node.expression);
        if (isEffectType(type, checker)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          problems.push(`${rel}:${line + 1}:${character + 1}  浮空 Effect 被丢弃: ${node.getText().slice(0, 80)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  /** 类型错误单独列出（脚本自身依赖类型检查可信） */
  const typeErrors = diagnostics
    .filter((d) => d.file && path.relative(ROOT, d.file.fileName).startsWith('src'))
    .map((d) => {
      const { line, character } = d.file!.getLineAndCharacterOfPosition(d.start ?? 0);
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      return `${path.relative(ROOT, d.file!.fileName)}:${line + 1}:${character + 1}  TS${d.code}: ${msg}`;
    });

  if (problems.length > 0) {
    console.error(`\n❌ 发现 ${problems.length} 处浮空 Effect（创建后未消费，代码不会执行）：\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n  修复：在 Effect.gen 内用 yield* 消费，或用 Effect.runPromise / Effect.runFork 显式运行。\n');
  } else {
    console.log('✅ 未发现浮空 Effect（所有 Effect 调用都被正确消费）');
  }

  if (typeErrors.length > 0) {
    console.error(`\n⚠️  源码存在 ${typeErrors.length} 个类型错误（可能影响检测准确性）：\n`);
    for (const e of typeErrors.slice(0, 20)) console.error(`  ${e}`);
  }

  if (problems.length > 0) process.exit(1);
}

main();
