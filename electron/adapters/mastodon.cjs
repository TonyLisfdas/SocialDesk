'use strict';
/**
 * Mastodon —— 任意实例，官方 REST API，免费
 * 凭证格式：  <instanceDomain>|<accessToken>
 *   例：      mastodon.social|xxxxxxxxxxxxxxxxxxxxxxxx
 * 拿 token：  实例网页 → 首选项 → 开发 → 新建应用 → 复制「访问令牌」
 */
const fs = require('node:fs');
const path = require('node:path');
const { httpFetch, readJson, composeText, humanError, mimeOf, clamp } = require('./_shared.cjs');

function parse(credential) {
  const raw = String(credential || '').trim();
  const idx = raw.indexOf('|');
  if (idx <= 0) return null;
  return { host: raw.slice(0, idx).trim().replace(/^https?:\/\//, '').replace(/\/$/, ''), token: raw.slice(idx + 1).trim() };
}

module.exports = {
  id: 'mastodon',
  label: 'Mastodon',
  mode: 'api',
  real: true,
  credentialHint: '<instance域>|<accessToken>',
  helpZh: '在你的实例网页 → 首选项 → 开发 → 新建应用，复制访问令牌。格式：mastodon.social|token',
  helpEn: 'Instance Preferences → Development → New application → copy the access token. Format: instance|token',

  async test(credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '凭证格式应为 <instance域>|<accessToken>' };
    try {
      const res = await httpFetch(`https://${p.host}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${p.token}` },
      });
      const json = await readJson(res);
      if (json.acct) return { ok: true, message: `连接成功：@${json.acct}@${p.host}` };
      return { ok: false, message: `验证失败（HTTP ${res.status}）：${json.error || ''}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },

  async publish(ctx, credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '缺少凭证（<instance域>|<accessToken>）' };
    const text = clamp(composeText(ctx), 500);
    const files = (ctx.media || []).filter((m) => m.path && fs.existsSync(m.path)).slice(0, 4);

    try {
      const mediaIds = [];
      for (const f of files) {
        const form = new FormData();
        form.append('file', new Blob([fs.readFileSync(f.path)], { type: mimeOf(f.path, f.mime) }), path.basename(f.path));
        if (f.name) form.append('description', String(f.name).slice(0, 400));
        const up = await httpFetch(`https://${p.host}/api/v2/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p.token}` },
          body: form,
        }, 60000);
        const upJson = await readJson(up);
        if (up.ok && upJson.id) mediaIds.push(upJson.id);
      }

      const body = { status: text, visibility: 'public' };
      if (mediaIds.length) body.media_ids = mediaIds;

      const res = await httpFetch(`https://${p.host}/api/v1/statuses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (json.url) return { ok: true, message: `已发布到 ${p.host}`, externalId: json.url };
      return { ok: false, message: `发布失败（HTTP ${res.status}）：${json.error || ''}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },
};
