import { describe, expect, it } from 'vitest';
import init from './index';

const PLUGIN_ID = 'typecho-plugin-netease-moodplayer';

function setupHooks() {
  const hooks = new Map<string, Function>();
  init({
    pluginId: PLUGIN_ID,
    addHook: (point: string, _id: string, handler: Function) => {
      hooks.set(point, handler);
    },
  } as any);
  return hooks;
}

// 与示例一致的 options 格式：'plugin:<id>' -> JSON 字符串
function withConfig(config: Record<string, unknown>) {
  return { options: { [`plugin:${PLUGIN_ID}`]: JSON.stringify(config) } };
}

describe('Netease mood-player plugin', () => {
  it('registers the frontend and admin editor hooks', () => {
    const hooks = setupHooks();
    expect(hooks.has('archive:footer')).toBe(true);
    expect(hooks.has('admin:writePost:bottom')).toBe(true);
    expect(hooks.has('admin:writePage:bottom')).toBe(true);
  });

  it('archive:footer appends the converter script with default config', () => {
    const footer = setupHooks().get('archive:footer') as Function;
    const out = footer('<footer></footer>', { options: {} });

    expect(out).toContain('<footer></footer>');

    // 默认配置值（JSON.stringify 后带双引号）
    expect(out).toContain('"https://api.qijieya.cn/meting"');
    expect(out).toContain('"?type="');
    expect(out).toContain('"&id="');
    expect(out).toContain('"small"');

    // 关键逻辑仍然存在
    expect(out).toContain('function buildTag');
    expect(out).toContain('function extractFromUrl');
    expect(out).toContain('function processRoot');
    expect(out).toContain('function findRoots');
    expect(out).toContain('mood-player');
    expect(out).toContain('music.163.com');

    // & 转义（最终标签里应为 &amp;）
    expect(out).toContain("replace(/&/g, '&amp;')");

    // Swup 切页重新触发
    expect(out).toContain("addEventListener('page:view'");
    expect(out).toContain("addEventListener('swup:page:view'");
  });

  it('archive:footer honours custom apiBase / pathType / pathId / playerSize', () => {
    const footer = setupHooks().get('archive:footer') as Function;
    const out = footer(
      '<footer></footer>',
      withConfig({
        apiBase: 'https://custom.example.com/api',
        pathType: '/t/',
        pathId: '/i/',
        playerSize: 'normal',
      })
    );

    expect(out).toContain('"https://custom.example.com/api"');
    expect(out).toContain('"/t/"');
    expect(out).toContain('"/i/"');
    expect(out).toContain('"normal"');
  });

  it('admin editor hooks append the netease dialog UI (default config)', () => {
    const hooks = setupHooks();
    for (const point of ['admin:writePost:bottom', 'admin:writePage:bottom']) {
      const handler = hooks.get(point) as Function;
      const out = handler('<form></form>', { options: {} });

      expect(out).toContain('<form></form>');
      // 对话框与按钮结构
      expect(out).toContain('netease-dialog');
      expect(out).toContain('ne-dialog-input');
      expect(out).toContain('netease-fallback-container');
      expect(out).toContain('wmd-netease-button');
      // 内联图标（SVG 路径片段）
      expect(out).toContain('M9 4c-2.93');
      // 内联逻辑函数
      expect(out).toContain('function buildTag');
      expect(out).toContain('function parseNetease');
      expect(out).toContain('function initDialog');
      expect(out).toContain('function initButton');
      // 默认配置值
      expect(out).toContain('"https://api.qijieya.cn/meting"');
      expect(out).toContain('"?type="');
      expect(out).toContain('"&id="');
      expect(out).toContain('"small"');
    }
  });

  it('admin editor hooks use custom config values', () => {
    const hooks = setupHooks();
    for (const point of ['admin:writePost:bottom', 'admin:writePage:bottom']) {
      const handler = hooks.get(point) as Function;
      const out = handler(
        '<form></form>',
        withConfig({
          apiBase: 'https://custom.example.com/api',
          pathType: '/t/',
          pathId: '/i/',
          playerSize: 'normal',
        })
      );

      expect(out).toContain('"https://custom.example.com/api"');
      expect(out).toContain('"/t/"');
      expect(out).toContain('"/i/"');
      expect(out).toContain('"normal"');
    }
  });
});