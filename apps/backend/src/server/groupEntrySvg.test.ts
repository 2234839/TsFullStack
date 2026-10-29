import { describe, expect, it } from 'vitest';
import { buildGroupEntrySvg } from './groupEntrySvg';

const groupImage = 'data:image/png;base64,Z3JvdXA=';
const officialImage = 'data:image/png;base64,b2ZmaWNpYWw=';

describe('buildGroupEntrySvg', () => {
  it('有群码时并排内嵌微信群码和公众号码', () => {
    const svg = buildGroupEntrySvg({
      group: { dataUrl: groupImage, title: '交流群', hint: '微信扫码入群' },
      official: { dataUrl: officialImage, title: '测试公众号', hint: '关注后回复「加群」' },
    });

    expect(svg).toContain('width="840"');
    expect(svg).toContain(groupImage);
    expect(svg).toContain(officialImage);
    expect(svg).toContain('交流群');
    expect(svg).toContain('测试公众号');
    expect(svg).toContain('和开发者一起');
    expect(svg).not.toContain('http://placeholder');
  });

  it('无群码时只展示公众号卡片', () => {
    const svg = buildGroupEntrySvg({
      official: { dataUrl: officialImage, title: '测试公众号', hint: '关注后回复「加群」' },
    });

    expect(svg).toContain('width="840"');
    expect(svg).toContain(officialImage);
    expect(svg).not.toContain(groupImage);
    expect(svg).not.toContain('微信扫码入群');
    expect(svg).toContain('先关注公众号');
  });

  it('公众号码缺失时展示文字引导，并转义配置文案', () => {
    const svg = buildGroupEntrySvg({
      official: { title: '测试<&公众号', hint: '回复「加群」' },
    });

    expect(svg).toContain('测试&lt;&amp;公众号');
    expect(svg).toContain('二维码暂未配置');
    expect(svg).not.toContain('<image');
  });
});
