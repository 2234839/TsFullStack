// ==UserScript==
// @name         硅基流动模型广场 - 免费模型筛选 + 价格徽标
// @namespace    https://github.com/gs
// @version      1.2.0
// @description  在模型广场页添加「只看免费」开关；免费判定不依赖卡片 Free 标签（站方有漏标，如 Qwen3.5-4B），而是并发拉取 biz-server 定价接口，输入/输出单价均为 0 才算免费；同时在每张卡片叠加价格徽标
// @author       gs
// @match        https://cloud.siliconflow.cn/me/models*
// @match        https://cloud.siliconflow.cn/models*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /** 隐藏卡片用的 class 标记 */
  const HIDE_CLASS = 'sf-free-hide';
  /** 价格缓存键（sessionStorage，含时间戳做 TTL） */
  const CACHE_KEY = 'sf-biz-price-cache-v1';
  /** 缓存有效期 1 小时 */
  const CACHE_TTL = 60 * 60 * 1000;
  /** 并发拉取上限 */
  const CONCURRENCY = 8;
  /** modelId -> { free, inputPrice, outputPrice }（单价单位：元 / K tokens） */
  let priceMap = new Map();
  /** modelName -> modelId（卡片 DOM 只有名字，需要靠它关联） */
  const idByName = new Map();
  /** 当前是否处于“只看免费”模式 */
  let onlyFree = false;
  /** 定价数据是否已就绪 */
  let ready = false;

  /*
   * 不能用内联 style.display 隐藏：该站 Tailwind 编译为 .flex { display: flex !important }，
   * 类级 !important 会压过非 important 内联样式。改为注入样式表 + class 开关。
   * 价格徽标样式一并注入，双类选择器保底提权。
   */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .${HIDE_CLASS}.${HIDE_CLASS} { display: none !important; }
    .sf-price-badge {
      position:absolute; left:8px; bottom:6px; z-index:5;
      display:flex; gap:6px; font-size:11px; line-height:1.4;
      font-family:ui-monospace,Consolas,monospace; pointer-events:none;
    }
    .sf-price-badge span {
      padding:1px 6px; border-radius:4px; background:rgba(15,23,42,.78); color:#e2e8f0;
    }
    .sf-price-badge .sf-free { background:rgba(22,163,74,.85); color:#fff; font-weight:600; }
  `;
  document.head.appendChild(styleEl);

  /* ---------------- 定价数据获取 ---------------- */

  /** 从 Next.js SSR 数据（__next_f）解析出 { modelId, modelName } 列表 */
  function parseModelsFromFlight() {
    const raw = (window.__next_f || []).map((x) => x[1] || '').join('');
    const out = [];
    const re = /"modelId":"(\d+)","modelName":"([^"]+)"/g;
    let m;
    while ((m = re.exec(raw)) !== null) out.push({ modelId: m[1], modelName: m[2] });
    return out;
  }

  /** 读缓存；过期或不存在返回 null */
  function loadCache() {
    try {
      const s = sessionStorage.getItem(CACHE_KEY);
      if (!s) return null;
      const { ts, map } = JSON.parse(s);
      if (Date.now() - ts > CACHE_TTL) return null;
      return map;
    } catch {
      return null;
    }
  }

  function saveCache(map) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map: [...map] }));
    } catch {
      /* 存储满等异常直接忽略，仅损失缓存 */
    }
  }

  /**
   * 拉单个模型定价并归一化
   * @returns {Promise<{free:boolean,inputPrice:number,outputPrice:number}|null>}
   */
  async function fetchPrice(modelId) {
    const r = await fetch(`/biz-server/api/v1/playground/${modelId}/biz_info`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const j = await r.json();
    const groups = j?.data?.definitionPricingGroup || [];
    let inputPrice = null;
    let outputPrice = null;
    for (const g of groups) {
      for (const fg of g.functionPricingGroups || []) {
        const code = fg.functionInfo?.functionCode;
        const p = fg.pricingGroups?.[0]?.pricingInfo;
        if (!p) continue;
        if (code === 'input-tokens') inputPrice = Number(p.stdUnitPrice);
        if (code === 'output-tokens') outputPrice = Number(p.stdUnitPrice);
      }
    }
    if (inputPrice === null || outputPrice === null) return null;
    return { free: inputPrice === 0 && outputPrice === 0, inputPrice, outputPrice };
  }

  /** 简单并发池 */
  async function runPool(tasks, limit) {
    const queue = [...tasks];
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        try {
          await t();
        } catch {
          /* 单个失败不阻断整体 */
        }
      }
    });
    await Promise.all(workers);
  }

  /** 初始化定价数据：缓存命中直接用，否则并发拉全部模型 */
  async function initPrices() {
    const cached = loadCache();
    if (cached) {
      priceMap = new Map(cached);
      for (const { modelId, modelName } of parseModelsFromFlight()) idByName.set(modelName, modelId);
      ready = true;
      applyFilter();
      return;
    }
    const models = parseModelsFromFlight();
    for (const { modelId, modelName } of models) idByName.set(modelName, modelId);
    await runPool(
      models.map(({ modelId }) => async () => {
        const p = await fetchPrice(modelId);
        if (p) priceMap.set(modelId, p);
      }),
      CONCURRENCY,
    );
    ready = true;
    saveCache(priceMap);
    applyFilter();
  }

  /* ---------------- 卡片渲染与筛选 ---------------- */

  /** 取当前页面全部模型卡片 */
  function getCards() {
    return [...document.querySelectorAll('div[class*="cursor-pointer"][class*="rounded-lg"]')].filter(
      (el) =>
        // 必须含有模型名节点（truncate 容器），排除误命中的其它可点击卡片
        el.querySelector('div[class*="truncate"]') !== null && el.textContent.length > 50,
    );
  }

  /** 卡片 -> modelId（卡片只展示 modelName，经映射表反查） */
  function cardModelId(card) {
    const name = card.querySelector('div[class*="truncate"]')?.textContent?.trim();
    return name ? idByName.get(name) : undefined;
  }

  /** 价格展示：元/K tokens 换算为 元/M tokens，避免过多小数位 */
  function priceText(n) {
    const perM = n * 1000;
    return perM >= 1 ? perM.toFixed(perM >= 100 ? 0 : 1) : perM.toFixed(2);
  }

  /** 给卡片叠加/刷新价格徽标 */
  function renderBadge(card, info) {
    let badge = card.querySelector(':scope > .sf-price-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'sf-price-badge';
      card.appendChild(badge);
    }
    badge.innerHTML = info.free
      ? '<span class="sf-free">Free（输入/输出均 0）</span>'
      : `<span>入 ¥${priceText(info.inputPrice)}/M</span><span>出 ¥${priceText(info.outputPrice)}/M</span>`;
  }

  /** 按当前模式刷新全部卡片的可见性、价格徽标与统计 */
  function applyFilter() {
    const cards = getCards();
    let freeCount = 0;
    let pricedCount = 0;
    for (const card of cards) {
      const id = cardModelId(card);
      const info = ready && id ? priceMap.get(id) : undefined;
      if (info) {
        pricedCount++;
        renderBadge(card, info);
        if (info.free) freeCount++;
        card.classList.toggle(HIDE_CLASS, onlyFree && !info.free);
      } else {
        // 数据未就绪/拉取失败的卡片：筛选开启时保守显示，等数据到位再收敛
        card.classList.remove(HIDE_CLASS);
      }
    }
    updateBadge(cards.length, freeCount, pricedCount);
  }

  /** 更新按钮上的统计文字 */
  function updateBadge(total, freeCount, pricedCount) {
    if (!btnEl) return;
    if (!ready) {
      btnEl.textContent = `⏳ 正在拉取价格…（${pricedCount}/${total}）`;
      return;
    }
    btnEl.textContent = onlyFree
      ? `✅ 免费模型 ${freeCount}/${total}（点击显示全部）`
      : `🎁 只看免费模型（${freeCount}/${total}）`;
  }

  let btnEl = null;

  /** 创建悬浮按钮 */
  function createButton() {
    if (btnEl) return;
    btnEl = document.createElement('button');
    btnEl.style.cssText = [
      'position:fixed',
      'right:24px',
      'bottom:32px',
      'z-index:99999',
      'padding:10px 16px',
      'border:none',
      'border-radius:9999px',
      'background:linear-gradient(135deg,#7c3aed,#4f46e5)',
      'color:#fff',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(79,70,229,.4)',
    ].join(';');
    btnEl.addEventListener('click', () => {
      onlyFree = !onlyFree;
      applyFilter();
      if (onlyFree) {
        // 开启后滚回顶部，避免停留在一整屏都被隐藏的区域
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    document.body.appendChild(btnEl);
    applyFilter();
  }

  /** 监听 DOM 变化：SPA 重渲染 / 懒加载追加卡片后自动重新套用筛选 */
  function watchDom() {
    const mo = new MutationObserver(() => {
      // 防抖：渲染风暴时合并为一次刷新
      clearTimeout(watchDom._t);
      watchDom._t = setTimeout(applyFilter, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    createButton();
    watchDom();
    initPrices();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
