'use strict';
/**
 * Telegram Bot API —— 最容易接通的真实发布通道
 * 凭证格式：  <botToken>|<chatId>
 * 例：        123456:AAHxxxxxxxx|-1001234567890
 * 拿 token：  Telegram 里找 @BotFather 发 /newbot
 * 拿 chatId： 把 bot 拉进群/频道，访问
 *             https://api.telegram.org/bot<token>/getUpdates 看 chat.id
 */
const fs = require('node:fs');
const path = require('node:path');
const { httpFetch, readJson, composeText, humanError, splitCredential, mimeOf } = require('./_shared.cjs');

const API = 'https://api.telegram.org';

function parse(credential) {
  const parts = splitCredential(credential, '|', 2);
  if (!parts) return null;
  // token 本身不含 |，但 chatId 可能是负数是正常的；从最后一个 | 切
  const raw = String(credential).trim();
  const idx = raw.lastIndexOf('|');
  const token = raw.slice(0, idx).trim();
  const chatId = raw.slice(idx + 1).trim();
  if (!token.includes(':')) return null;
  return { token, chatId };
}

async function call(token, method, body) {
  const res = await httpFetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson(res);
}

module.exports = {
  id: 'telegram',
  label: 'Telegram Bot API',
  mode: 'api',
  real: true,
  credentialHint: '<botToken>|<chatId>',
  helpZh: '找 @BotFather 建 bot 拿 token；把 bot 拉进目标群/频道后从 getUpdates 拿 chatId。格式：token|chatId',
  helpEn: 'Create a bot via @BotFather, add it to your chat/channel, read chat.id from getUpdates. Format: token|chatId',

  async test(credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '凭证格式应为 <botToken>|<chatId>' };
    try {
      const json = await call(p.token, 'getMe', {});
      if (!json.ok) return { ok: false, message: `Token 无效：${json.description || '未知错误'}` };
      return { ok: true, message: `连接成功：@${json.result.username}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },

  async publish(ctx, credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '缺少凭证（<botToken>|<chatId>）' };
    const text = composeText(ctx);
    const files = (ctx.media || []).filter((m) => m.path && fs.existsSync(m.path));

    try {
      if (files.length === 1) {
        const f = files[0];
        const isVideo = f.type === 'video';
        const form = new FormData();
        form.append('chat_id', p.chatId);
        form.append('caption', text.slice(0, 1024));
        form.append(
          isVideo ? 'video' : 'photo',
          new Blob([fs.readFileSync(f.path)], { type: mimeOf(f.path, f.mime) }),
          path.basename(f.path),
        );
        const res = await httpFetch(`${API}/bot${p.token}/${isVideo ? 'sendVideo' : 'sendPhoto'}`, {
          method: 'POST',
          body: form,
        });
        const json = await readJson(res);
        return {
          ok: !!json.ok,
          message: json.ok ? '已通过 Telegram Bot API 发布（含素材）' : `发送失败：${json.description || '未知错误'}`,
          externalId: json.result ? String(json.result.message_id) : undefined,
        };
      }

      if (files.length > 1) {
        const group = files.slice(0, 10).map((f, i) => ({
          type: 'photo',
          media: `attach://file${i}`,
          ...(i === 0 ? { caption: text.slice(0, 1024) } : {}),
        }));
        const form = new FormData();
        form.append('chat_id', p.chatId);
        form.append('media', JSON.stringify(group));
        files.slice(0, 10).forEach((f, i) => {
          form.append(
            `file${i}`,
            new Blob([fs.readFileSync(f.path)], { type: mimeOf(f.path, f.mime) }),
            path.basename(f.path),
          );
        });
        const res = await httpFetch(`${API}/bot${p.token}/sendMediaGroup`, { method: 'POST', body: form });
        const json = await readJson(res);
        return {
          ok: !!json.ok,
          message: json.ok
            ? `已通过 Telegram 发布（${Math.min(files.length, 10)} 个素材）`
            : `发送失败：${json.description || '未知错误'}`,
        };
      }

      const json = await call(p.token, 'sendMessage', {
        chat_id: p.chatId,
        text,
        disable_web_page_preview: false,
      });
      return {
        ok: !!json.ok,
        message: json.ok ? '已通过 Telegram Bot API 发布' : `发送失败：${json.description || '未知错误'}`,
        externalId: json.result ? String(json.result.message_id) : undefined,
      };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },
};
