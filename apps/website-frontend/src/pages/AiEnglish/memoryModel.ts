import { DefaultScheduler, Rating, type DefaultScheduler as Scheduler, type Grade } from 'ts-fsrs';
import { toRaw } from 'vue';
import type { WordData } from './data';

/**
 * FSRS 记忆模型封装（ts-fsrs v6 / DefaultScheduler / FSRS-7）：
 * - 每个单词维护一张 FSRS Card（难度 D / 稳定性 S / 复习记录），序列化后存入 WordData.fsrsCard
 * - memoryLevel (0-10) 不再手工增减，由当前可提取性 R（遗忘曲线）推导，天然带时间衰减
 * - 信号映射（结合现有被动学习流）：
 *   - 查词（点开看翻译）  = 提取失败 → Again（新词首查记 Hard，是学习而非遗忘）
 *   - 段落结算时未查的词  = 阅读中成功识别 → Good
 *   - 手动滑块调熟练度    = 用户主观自评 → 按档位映射为 Again/Hard/Good/Easy
 */

/** 目标记忆保持率：FSRS 按「复习时仍有 90% 概率记得」来安排间隔 */
const DESIRED_RETENTION = 0.9;

let schedulerPromise: Promise<Scheduler> | null = null;
let cachedScheduler: Scheduler | null = null;

/** 调度器内部使用的 FSRS-7 卡片类型（由 newCard 推导） */
type FsrsCard = ReturnType<Scheduler['newCard']>;

/** 惰性初始化调度器（DefaultScheduler 是异步工厂） */
export const initMemoryScheduler = async (): Promise<Scheduler> => {
  schedulerPromise ??= DefaultScheduler({ desiredRetention: DESIRED_RETENTION });
  cachedScheduler ??= await schedulerPromise;
  return cachedScheduler;
};

const getSchedulerSync = (): Scheduler => {
  if (!cachedScheduler) throw new Error('[memoryModel] 调度器尚未初始化，需先 await initMemoryScheduler');
  return cachedScheduler;
};

/** 存储层用的可序列化卡片：Date 转 ISO 字符串，其余原样 JSON */
export type SerializedCard = Record<string, unknown>;

/** ISO 日期字符串特征（YYYY-MM-DDT 开头且可解析） */
const isIsoDateTime = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

/** 深序列化：Date → ISO 字符串 */
const serialize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
};

/** 深反序列化：ISO 日期字符串 → Date */
const deserialize = (value: unknown): unknown => {
  if (isIsoDateTime(value)) return new Date(value);
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deserialize(v);
    return out;
  }
  return value;
};

/** 当前可提取性 R ∈ [0,1]：新词无复习记录时为 0 */
const currentRetrievability = (card: FsrsCard, now: Date): number => {
  if (card.reps === 0 || !(card.lastReviewAt instanceof Date)) return 0;
  /** 遗忘曲线按「距上次复习的 fractional days」计算 */
  const elapsedDays = Math.max(0, (now.getTime() - card.lastReviewAt.getTime()) / 86_400_000);
  return getSchedulerSync().model.forgettingCurve(
    { stability: card.stability, difficulty: card.difficulty, stabilityFast: card.stabilityFast },
    elapsedDays,
  );
};

/** 解除 Vue reactive 代理后再深拷贝：reactive 代理无法被 structuredClone 克隆（DataCloneError）；
 * toRaw 返回的原始对象内部存的也是原始引用，克隆结果与代理层完全解耦 */
const deepClone = <T>(value: T): T => structuredClone(toRaw(value));

/** 由可提取性 R 推导 0-10 展示等级（R=90% → 9 档，随遗忘曲线自然下滑） */
export const memoryLevelFromCard = (serialized: SerializedCard | undefined, now = new Date()): number => {
  if (!serialized) return 0;
  const card = deserialize(deepClone(serialized)) as FsrsCard;
  return Math.max(0, Math.min(10, Math.round(currentRetrievability(card, now) * 10)));
};

/** 对单词做一次 FSRS 复习并更新展示等级，返回更新后的 WordData（不可变） */
export const applyReview = async (wordData: WordData, grade: Grade, now = new Date()): Promise<WordData> => {
  await initMemoryScheduler();
  const cardIn = wordData.fsrsCard
    ? (deserialize(deepClone(wordData.fsrsCard)) as FsrsCard)
    : getSchedulerSync().newCard({ now });
  const { card } = getSchedulerSync().review({ card: cardIn, grade, now });
  const serialized = serialize(card) as SerializedCard;
  return { ...wordData, fsrsCard: serialized, memoryLevel: memoryLevelFromCard(serialized, now) };
};

/** 仅按遗忘曲线刷新展示等级（不产生复习记录）：让久未接触的词等级随时间下滑 */
export const refreshMemoryLevel = (wordData: WordData, now = new Date()): WordData => {
  const level = memoryLevelFromCard(wordData.fsrsCard, now);
  return level === wordData.memoryLevel ? wordData : { ...wordData, memoryLevel: level };
};

/** 查词信号：新词首查是学习行为（Hard），老词查词是遗忘（Again） */
export const applyLookupSignal = (wordData: WordData, now = new Date()): Promise<WordData> => {
  const reps = (wordData.fsrsCard?.['reps'] as number | undefined) ?? 0;
  return applyReview(wordData, reps === 0 ? Rating.Hard : Rating.Again, now);
};

/** 阅读中成功识别（段落结算时未查词）信号 */
export const applyRecognitionSignal = (wordData: WordData, now = new Date()): Promise<WordData> =>
  applyReview(wordData, Rating.Good, now);

/** 手动滑块：主观自评映射到 FSRS 评分档 */
export const applyManualLevel = (wordData: WordData, level: number, now = new Date()): Promise<WordData> => {
  const grade: Grade = level <= 2 ? Rating.Again : level <= 4 ? Rating.Hard : level <= 8 ? Rating.Good : Rating.Easy;
  return applyReview(wordData, grade, now);
};

export { Rating };
