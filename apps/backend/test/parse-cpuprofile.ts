/**
 * 解析 .cpuprofile：按函数聚合 self 时间（微秒），输出 Top N 与总采样
 * 用法：npx tsx test/parse-cpuprofile.ts <file.cpuprofile> [topN]
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const topN = Number(process.argv[3] ?? 25);
const prof = JSON.parse(readFileSync(file as string, 'utf8')) as {
  nodes: Array<{
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number };
    hitCount?: number;
    children?: number[];
  }>;
  samples?: number[];
  timeDeltas?: number[];
};

const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const selfMicros = new Map<number, number>();
if (prof.samples && prof.timeDeltas) {
  for (let i = 0; i < prof.samples.length; i++) {
    const d = prof.timeDeltas[i] ?? 0;
    if (d <= 0) continue;
    const id = prof.samples[i] as number;
    selfMicros.set(id, (selfMicros.get(id) ?? 0) + d);
  }
} else {
  for (const n of prof.nodes) if (n.hitCount) selfMicros.set(n.id, n.hitCount * 10);
}

const agg = new Map<string, number>();
let total = 0;
for (const [id, us] of selfMicros) {
  const n = byId.get(id);
  if (!n) continue;
  total += us;
  const url = (n.callFrame.url || '(native)').replace(/^file:\/\//, '');
  const shortUrl = url.includes('node_modules')
    ? url.replace(/.*node_modules\/((\.pnpm\/)?([^/]+)).*/, '$3')
    : url.replace(/.*TsFullStack\/(apps|packages)\//, '$1/');
  const key = `${n.callFrame.functionName || '(anonymous)'} @ ${shortUrl}:${n.callFrame.lineNumber + 1}`;
  agg.set(key, (agg.get(key) ?? 0) + us);
}
const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]);
console.log(`总 self 采样: ${(total / 1000).toFixed(1)}ms`);
for (const [k, us] of sorted.slice(0, topN)) {
  console.log(`${(us / 1000).toFixed(1).padStart(8)}ms ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

/** 按包/类别聚合（剔除 idle，看真实 CPU 去向） */
const categories: Array<[string, RegExp]> = [
  [
    'tsx转译/模块加载',
    /tsx|esm\/|module_job|loader|hooks|source_map|cjs\/|getPackageScope|package_json_reader|bootstrap/,
  ],
  ['GC', /garbage collector/],
  ['ZenStack ORM', /@zenstackhq|zenstack/],
  ['Kysely 建查询', /kysely/],
  ['zod 校验', /zod/],
  ['SQLite 驱动', /better-sqlite3|sqlite|statement/i],
  ['worker 消息传递', /postMessage|receiveMessageOnPort|worker\/io|worker:internal/],
  ['Effect', /effect/],
];
const catAgg = new Map<string, number>();
let catTotal = 0;
for (const [k, us] of agg) {
  if (k.startsWith('(idle)')) continue;
  const hit = categories.find(([, re]) => re.test(k));
  const name = hit ? hit[0] : '其他';
  catAgg.set(name, (catAgg.get(name) ?? 0) + us);
  catTotal += us;
}
console.log(`\n分类聚合（剔除 idle 后 ${(catTotal / 1000).toFixed(0)}ms）:`);
for (const [k, us] of [...catAgg.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${(us / 1000).toFixed(1).padStart(8)}ms ${((us / catTotal) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
const others = sorted.filter(([k]) => {
  if (k.startsWith('(idle)') || k.startsWith('(program)')) return false;
  return !categories.some(([, re]) => re.test(k));
});
console.log(`\n其他 Top:`);
for (const [k, us] of others.slice(0, 8)) console.log(`${(us / 1000).toFixed(1).padStart(8)}ms  ${k}`);
