'use strict';
/**
 * 通用 Webhook —— 万能出口
 *
 * 用途：海外平台（X / LinkedIn / Instagram / Threads / YouTube …）官方 API
 * 都需要 OAuth 授权和审核，流程长。最实用的做法是：
 *   自建一个中转服务（任意语言，几十行）→ 在中转服务里用官方 SDK 发布
 *   → 本工作台把内容 POST 给你的中转服务（即此 webhook）→ 由它去发。
 *
 * 本适配器会 POST 这样一个 JSON：
 * {
 *   platform: "linkedin",
 *   content: "正文（已含话题标签）",
 *   hashtags: ["tag1"],
 *   firstComment: "首评内容",
 *   scheduledAt: "2026-10-16T10:00:00.000Z",
 *   account: "@handle",
 *   media: [{ name, path, url, type, mime }]
 * }
 * 期望返回：{ ok: true } 或 HTTP 2xx 即视为成功；返回 { id: "..." } 会记为外部 ID。
 *
 * 凭证格式：  <URL>            或        <URL>|<自定义BearerToken>
 */
const { httpFetch, readJson, composeText, humanError, splitCredential } = require('./_shared.cjs');

function parse(credential) {
  const raw = String(credential || '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  const idx = raw.indexOf('|');
  if (idx < 0) return { url: raw, token: '' };
  return { url: raw.slice(0, idx).trim(), token: raw.slice(idx + 1).trim() };
}

module.exports = {
  id: 'webhook',
  label: '通用 Webhook 中转',
  mode: 'api',
  real: true,
  credentialHint: '<你的中转服务URL> 或 <URL>|<BearerToken>',
  helpZh:
    '把你的中转服务地址填这里。工作台会把 {platform, content, hashtags, media} POST 过去，返回 2xx 即算成功。适合接 X / LinkedIn / IG 等需要 OAuth 的平台。',
  helpEn:
    'Point this at your own relay service. The app POSTs {platform, content, hashtags, media}; any 2xx counts as success.',

  async test(credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '请填写 http(s):// 开头的中转服务地址' };
    try {
      const headers = p.token ? { Authorization: `Bearer ${p.token}` } : {};
      let res = await httpFetch(p.url, { method: 'HEAD', headers }, 12000);
      if (res.status === 405 || res.status === 501) {
        res = await httpFetch(p.url, { method: 'GET', headers }, 12000);
      }
      if (res.status < 400) return { ok: true, message: `中转服务可达（HTTP ${res.status}）` };
      return { ok: false, message: `中转服务返回 HTTP ${res.status}（地址写对了吗？）` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },

  async publish(ctx, credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '缺少中转服务地址' };
    const headers = { 'Content-Type': 'application/json' };
    if (p.token) headers.Authorization = `Bearer ${p.token}`;

    const payload = {
      platform: ctx.platformId,
      account: ctx.account || null,
      content: composeText(ctx),
      rawContent: ctx.content,
      hashtags: ctx.hashtags || [],
      firstComment: ctx.firstComment || null,
      scheduledAt: ctx.scheduledAt || null,
      media: (ctx.media || []).map((m) => ({ name: m.name, path: m.path, url: m.url, type: m.type, mime: m.mime })),
    };

    try {
      const res = await httpFetch(
        p.url,
        { method: 'POST', headers, body: JSON.stringify(payload) },
        60000,
      );
      const json = await readJson(res);
      if (res.ok) {
        const ok = json.ok === undefined ? true : !!json.ok;
        return {
          ok,
          message: ok ? `已通过中转服务发布（HTTP ${res.status}）` : `中转服务返回失败：${json.error || '未知'}`,
          externalId: json.id ? String(json.id) : undefined,
        };
      }
      return { ok: false, message: `中转服务返回 HTTP ${res.status}：${json.error || json.__raw || ''}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },
};
