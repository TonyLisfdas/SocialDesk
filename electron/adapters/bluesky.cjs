'use strict';
/**
 * Bluesky / AT Protocol —— 免费开放，无需审核，适合先跑通「真发布」
 * 凭证格式：  <handle>|<appPassword>     例：me.bsky.social|abcd-efgh-ijkl-mnop
 * 拿密码：    登录 bsky.app → 设置 → 应用密码（App Password），不要用主密码
 */
const fs = require('node:fs');
const path = require('node:path');
const { httpFetch, readJson, composeText, humanError, mimeOf, clamp } = require('./_shared.cjs');

const PDS = 'https://bsky.social';
const MAX_TEXT = 300;
const MAX_IMAGES = 4;

function parse(credential) {
  const raw = String(credential || '').trim();
  const idx = raw.indexOf('|');
  if (idx <= 0) return null;
  return { handle: raw.slice(0, idx).trim(), password: raw.slice(idx + 1).trim() };
}

async function createSession(handle, password) {
  const res = await httpFetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  const json = await readJson(res);
  if (!json.accessJwt) {
    throw new Error(json.message ? `登录失败：${json.message}` : '登录失败：账号或 App Password 不正确');
  }
  return json;
}

async function uploadBlob(session, filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await httpFetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': mimeOf(filePath),
    },
    body: buf,
  });
  const json = await readJson(res);
  if (!json.blob) throw new Error('图片上传失败');
  return json.blob;
}

module.exports = {
  id: 'bluesky',
  label: 'Bluesky (AT Protocol)',
  mode: 'api',
  real: true,
  credentialHint: '<handle>|<appPassword>',
  helpZh: '在 bsky.app 的设置 → 应用密码 生成一个 App Password（别用主密码）。格式：handle|appPassword',
  helpEn: 'Generate an App Password in bsky.app → Settings. Format: handle|appPassword',

  async test(credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '凭证格式应为 <handle>|<appPassword>' };
    try {
      const s = await createSession(p.handle, p.password);
      return { ok: true, message: `连接成功：${s.handle || p.handle}` };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },

  async publish(ctx, credential) {
    const p = parse(credential);
    if (!p) return { ok: false, message: '缺少凭证（<handle>|<appPassword>）' };

    try {
      const session = await createSession(p.handle, p.password);
      const text = clamp(composeText(ctx), MAX_TEXT);

      const embeds = { images: [] };
      const imgFiles = (ctx.media || [])
        .filter((m) => m.path && m.type !== 'video' && fs.existsSync(m.path))
        .slice(0, MAX_IMAGES);
      for (const f of imgFiles) {
        const blob = await uploadBlob(session, f.path);
        embeds.images.push({ alt: f.name || 'image', image: blob });
      }

      const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      };
      if (embeds.images.length) {
        record.embed = {
          $type: 'app.bsky.embed.images',
          images: embeds.images,
        };
      }

      const res = await httpFetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });
      const json = await readJson(res);
      if (!json.uri) return { ok: false, message: `发布失败：${json.message || '未知错误'}` };
      return {
        ok: true,
        message: embeds.images.length
          ? `已通过 AT Protocol 发布（${embeds.images.length} 张图）`
          : '已通过 AT Protocol 发布',
        externalId: json.uri,
      };
    } catch (e) {
      return { ok: false, message: humanError(e) };
    }
  },
};
