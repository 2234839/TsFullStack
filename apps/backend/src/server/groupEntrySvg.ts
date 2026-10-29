/** 动态引流 SVG 的一个二维码展示项 */
interface QrPanel {
  /** 已验证的图片 data URL；未配置时展示文字引导 */
  dataUrl?: string;
  /** 二维码下方标题 */
  title: string;
  /** 二维码下方操作提示 */
  hint: string;
}

/** XML 转义，空间名、群名和公众号配置均不能直接进入 SVG 文本 */
function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!,
  );
}

/** 限制单行标题长度，避免管理端长名称挤出 SVG 画布 */
function truncate(value: string, maxLength = 24): string {
  const chars = Array.from(value);
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : value;
}

/** 固定尺寸二维码卡片：图片保留完整比例，行动提示使用与入口类型一致的品牌色 */
function qrPanel(panel: QrPanel, x: number, tone: 'group' | 'official'): string {
  const width = 374;
  const imageSize = 202;
  const imageX = x + (width - imageSize) / 2;
  const centerX = x + width / 2;
  const accent = tone === 'group' ? '#059669' : '#2563eb';
  const actionBackground = tone === 'group' ? '#d1fae5' : '#dbeafe';
  const content = panel.dataUrl
    ? `<image x="${imageX}" y="158" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet" href="${panel.dataUrl}"/>`
    : [
        `<rect x="${imageX}" y="158" width="${imageSize}" height="${imageSize}" rx="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-dasharray="8 6"/>`,
        `<text x="${centerX}" y="251" text-anchor="middle" font-size="18" fill="#64748b">二维码暂未配置</text>`,
        `<text x="${centerX}" y="282" text-anchor="middle" font-size="15" fill="#64748b">请在微信中搜索公众号</text>`,
      ].join('');
  return [
    `<rect x="${x}" y="138" width="${width}" height="310" rx="20" fill="#ffffff" filter="url(#card-shadow)"/>`,
    `<rect x="${x + 20}" y="138" width="${width - 40}" height="4" rx="2" fill="${accent}"/>`,
    `<rect x="${imageX - 8}" y="150" width="${imageSize + 16}" height="${imageSize + 16}" rx="14" fill="#ffffff" stroke="#e2e8f0"/>`,
    content,
    `<text x="${centerX}" y="391" text-anchor="middle" font-size="21" font-weight="700" fill="#17251d">${escapeXml(truncate(panel.title, 16))}</text>`,
    `<rect x="${centerX - 119}" y="406" width="238" height="28" rx="14" fill="${actionBackground}"/>`,
    `<text x="${centerX}" y="425" text-anchor="middle" font-size="14" font-weight="700" fill="${accent}">${escapeXml(truncate(panel.hint, 20))}</text>`,
  ].join('');
}

/**
 * 生成 GitHub README 可引用的动态邀请卡：有群码时双码并排，无群码时仅保留公众号。
 * 二维码使用 base64 内嵌，SVG 无脚本、无远程资源，适合作为第三方图片加载。
 */
export function buildGroupEntrySvg(options: { group?: QrPanel; official: QrPanel }): string {
  const group = options.group;
  const hasGroup = group !== undefined;
  const width = 840;
  const height = 496;
  const panels = group
    ? `${qrPanel(group, 32, 'group')}${qrPanel(options.official, 434, 'official')}`
    : qrPanel(options.official, 233, 'official');
  const heading = hasGroup
    ? '和开发者一起，<tspan fill="#6ee7b7">把想法做成产品</tspan>'
    : '先关注公众号，<tspan fill="#93c5fd">不错过每一次相聚</tspan>';
  const subtitle = hasGroup ? '技术交流 · 项目共创 · 问题互助' : '群码暂时不可用，公众号会保留最新入群方式';
  const label = hasGroup ? '扫码加入微信群或关注公众号' : '关注公众号获取最新入群方式';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`,
    '<defs>',
    '<linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071f1a"/><stop offset="0.52" stop-color="#102a2a"/><stop offset="1" stop-color="#111d35"/></linearGradient>',
    '<radialGradient id="green-glow"><stop stop-color="#10b981" stop-opacity="0.2"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="blue-glow"><stop stop-color="#3b82f6" stop-opacity="0.2"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>',
    '<filter id="card-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.2"/></filter>',
    '</defs>',
    `<g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif">`,
    `<rect width="${width}" height="${height}" rx="24" fill="url(#background)"/>`,
    '<circle cx="30" cy="30" r="240" fill="url(#green-glow)"/><circle cx="810" cy="40" r="260" fill="url(#blue-glow)"/>',
    '<g fill="none" stroke="#6ee7b7" stroke-opacity="0.22"><circle cx="66" cy="75" r="24"/><path d="M66 43v64M34 75h64"/></g>',
    '<g fill="none" stroke="#93c5fd" stroke-opacity="0.22"><circle cx="778" cy="76" r="24"/><path d="m766 68-8 8 8 8m24-16 8 8-8 8m-16-24-8 32"/></g>',
    '<rect x="300" y="14" width="240" height="30" rx="15" fill="#ffffff" fill-opacity="0.08" stroke="#a7f3d0" stroke-opacity="0.2"/>',
    '<circle cx="322" cy="29" r="4" fill="#34d399"/>',
    '<text x="434" y="34" text-anchor="middle" font-size="13" font-weight="600" letter-spacing="1.5" fill="#d1fae5">TSFULLSTACK · 开发者社群</text>',
    `<text x="420" y="86" text-anchor="middle" font-size="32" font-weight="800" fill="#f8fafc">${heading}</text>`,
    `<text x="420" y="117" text-anchor="middle" font-size="16" fill="#b6c7c3">${subtitle}</text>`,
    panels,
    '<circle cx="305" cy="477" r="3" fill="#34d399"/>',
    '<text x="428" y="482" text-anchor="middle" font-size="13" fill="#9fb3ae">一个认真做产品、乐于分享的开发者社群</text>',
    '</g>',
    '</svg>',
  ].join('');
}
