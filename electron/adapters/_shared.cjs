'use strict';
/** 适配器公共工具（独立成文件，避免 index <-> adapter 循环依赖） */

/** 把正文和话题标签合成最终文案（多数平台话题是正文的一部分） */
function composeText(ctx) {
  const text = String(ctx.content || '').trim();
  const tags = (ctx.hashtags || [])
    .map((h) => String(h).trim())
    .filter(Boolean)
    .map((h) => (h.startsWith('#') ? h : `#${h}`));
  if (!tags.length) return text;
  const missing = tags.filter((t) => !text.includes(t));
  return missing.length ? `${text}\n\n${missing.join(' ')}` : text;
}

/** 带超时的 fetch —— 后台自动发布会长期运行，不能发出没有超时的请求 */
async function httpFetch(url, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text.slice(0, 500), __status: res.status };
  }
}

function humanError(e) {
  const msg = String((e && e.message) || e);
  if (/abort/i.test(msg)) return '请求超时（网络不可达或平台无响应）';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return '域名解析失败，请检查网络 / 代理';
  if (/ECONNREFUSED/i.test(msg)) return '连接被拒绝（本地桥服务没启动？）';
  if (/fetch failed/i.test(msg)) return '网络请求失败（可能需要配置代理）';
  return msg;
}

/** 凭证按分隔符拆成多个字段，任一为空则返回 null */
function splitCredential(credential, sep = '|', minParts = 2) {
  const parts = String(credential || '')
    .split(sep)
    .map((s) => s.trim());
  if (parts.length < minParts || parts.some((p) => !p)) return null;
  return parts;
}

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
};

function mimeOf(filePath, fallback = 'application/octet-stream') {
  const ext = String(filePath || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return (ext && MIME[ext[0]]) || fallback;
}

/** 截断到平台字数上限，并在末尾加省略号（避免静默失败） */
function clamp(text, max) {
  if (!max || text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + '…';
}

module.exports = { composeText, httpFetch, readJson, humanError, splitCredential, mimeOf, clamp };
