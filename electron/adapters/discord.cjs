'use strict';
/**
 * Discord Webhook —— 零成本、零审核，社区私域首选
 * 凭证格式：  直接填 Webhook URL
 *   例：https://discord.com/api/webhooks/123456/abcdefg
 * 拿地址：    服务器设置 → 整合 → Webhook → 新建 → 复制 URL
 */
const fs = require('node:fs');
const path = require('node:path');
const { httpFetch, readJson, composeText, humanError, mimeOf, clamp } = require('./_shared.cjs');

module.exports = {
  id: 'discord',
  label: 'Discord Webhook',
  mode: 'api',
  real: true,
  credentialHint: 'https://discord.com/api/webhooks/...',
  helpZh: '服务器设置 → 整合 → Webhook → 新建 → 复制 Webhook URL，直接粘贴即可',
  helpEn: 'Server Settings → Integrations → Webhooks → New → copy the Webhook URL',

  async test(credential) {
    const url = String(credential || '').trim();
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) {
      return { ok: false, message: '看起来不是 Discord Webhook 地址' };
    }
    try {
      const res = await httpFetch(url, { method: 'GET' });
      const json = await readJson(res);
      if (res.status === 200) return { ok: true, message: `连接成功：${json.name || 'webhook 有效'}` };
      return { ok: false, message: `Webhook 无效（HTTP ${res.status}）` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },

  async publish(ctx, credential) {
    const url = String(credential || '').trim();
    if (!url) return { ok: false, message: '缺少 Discord Webhook 地址' };
    const text = clamp(composeText(ctx), 2000);
    const files = (ctx.media || []).filter((m) => m.path && fs.existsSync(m.path)).slice(0, 10);

    try {
      let res;
      if (files.length) {
        const form = new FormData();
        form.append('payload_json', JSON.stringify({ content: text }));
        files.forEach((f, i) => {
          form.append(
            `files[${i}]`,
            new Blob([fs.readFileSync(f.path)], { type: mimeOf(f.path, f.mime) }),
            path.basename(f.path),
          );
        });
        res = await httpFetch(url, { method: 'POST', body: form }, 60000);
      } else {
        res = await httpFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
      }

      if (res.status === 204 || res.status === 200) {
        return { ok: true, message: '已通过 Discord Webhook 发布' };
      }
      const json = await readJson(res);
      return { ok: false, message: `发送失败（HTTP ${res.status}）：${json.message || ''}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },
};
