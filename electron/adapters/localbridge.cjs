'use strict';
/**
 * 本机 Python 桥 —— 国内平台唯一的现实通道
 *
 * 小红书 / 抖音 / 视频号 / B站 / 快手 都没有开放 API，
 * 业界通行做法是「扫码登录网页版 → 取 cookie → 程序模拟发布」。
 * 这类活最适合用 Python 干（开源项目 social-auto-upload 已实现），
 * 所以独立版的做法是：
 *
 *   工作台（Electron）  ──HTTP──▶  本机 Python 桥服务  ──▶  各平台
 *
 * 仓库里已附一个可直接运行的桥服务：bridge/social_bridge.py
 * 启动：python bridge/social_bridge.py   （默认监听 127.0.0.1:5409）
 *
 * 凭证格式：  http://127.0.0.1:5409     （或只写端口：5409）
 */
const { httpFetch, readJson, composeText, humanError } = require('./_shared.cjs');

const DEFAULT_BASE = 'http://127.0.0.1:5409';

function parse(credential) {
  const raw = String(credential || '').trim();
  if (!raw) return { base: DEFAULT_BASE, empty: true };
  if (/^\d+$/.test(raw)) return { base: `http://127.0.0.1:${raw}` };
  if (/^https?:\/\//i.test(raw)) return { base: raw.replace(/\/$/, '') };
  return { base: `http://${raw.replace(/\/$/, '')}` };
}

module.exports = {
  id: 'localbridge',
  label: '本机 Python 桥（国内平台）',
  mode: 'cookie',
  real: true,
  credentialHint: 'http://127.0.0.1:5409',
  helpZh:
    '运行 bridge/social_bridge.py（默认 5409 端口），再在这里填地址。工作台会把内容和本地素材路径发给桥服务，由它用 cookie 会话发布到小红书/抖音/视频号/B站/快手。',
  helpEn:
    'Run bridge/social_bridge.py (port 5409) and put its URL here. The bridge publishes to CN platforms using cookie sessions.',

  async test(credential) {
    const p = parse(credential);
    try {
      const res = await httpFetch(`${p.base}/health`, {}, 6000);
      const json = await readJson(res);
      if (res.ok && json.ok) {
        const list = Array.isArray(json.platforms) ? json.platforms.join(', ') : '（未报告）';
        return { ok: true, message: `桥服务在线；已就绪平台：${list}` };
      }
      return { ok: false, message: `桥服务返回异常（HTTP ${res.status}）` };
    } catch (e) {
      return {
        ok: false,
        message: `${humanError(e)}。请先运行 python bridge/social_bridge.py（${p.base}）`,
      };
    }
  },

  async publish(ctx, credential) {
    const p = parse(credential);
    const payload = {
      platform: ctx.platformId,
      account: ctx.account || null,
      title: (ctx.content || '').split('\n')[0].slice(0, 60),
      content: composeText(ctx),
      hashtags: ctx.hashtags || [],
      firstComment: ctx.firstComment || null,
      scheduledAt: ctx.scheduledAt || null,
      // 桥服务可以直接读这些本地绝对路径 —— 这是浏览器版永远做不到的
      mediaPaths: (ctx.media || []).map((m) => m.path).filter(Boolean),
      media: (ctx.media || []).map((m) => ({ name: m.name, url: m.url, type: m.type })),
    };

    try {
      const res = await httpFetch(`${p.base}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 180000); // 视频上传 + 平台处理可能要几分钟
      const json = await readJson(res);
      if (res.ok && json.ok !== false) {
        return {
          ok: true,
          message: json.message || `已通过桥服务发布到 ${ctx.platformId}`,
          externalId: json.id ? String(json.id) : undefined,
        };
      }
      return { ok: false, message: json.message || json.error || `桥服务返回 HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: `${humanError(e)}（检查 bridge/social_bridge.py 是否在运行）` };
    }
  },
};
