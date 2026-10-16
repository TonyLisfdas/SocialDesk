'use strict';
/**
 * 发布执行器：把一条内容按平台分发到各自的适配器。
 * 与浏览器版的区别：真实网络请求 + 真实本地素材路径 + 逐平台独立结果。
 */
const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./paths.cjs');
const { getAdapter, channelMap } = require('./adapters/index.cjs');
const platformMeta = require('./platform-meta.cjs');
const { log } = require('./logger.cjs');

/** 把 sdmedia://media/xxx 还原成本地绝对路径 */
function resolveLocalPath(item) {
  if (item.path && fs.existsSync(item.path)) return item.path;
  const url = String(item.url || '');
  const m = url.match(/^sdmedia:\/\/media\/(.+)$/);
  if (m) {
    const p = path.join(paths().mediaDir, decodeURIComponent(m[1]));
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 收集这条内容用到的素材（含本地绝对路径，供适配器直接上传） */
function collectMedia(db, post) {
  const out = [];
  for (const id of post.mediaIds || []) {
    const item = (db.media || []).find((m) => m.id === id);
    if (!item) continue;
    out.push({
      id: item.id,
      name: item.name,
      type: item.type || 'image',
      mime: item.mime || '',
      url: item.url || '',
      path: resolveLocalPath(item),
    });
  }
  return out;
}

/** 某平台最终要发的正文：平台级覆盖优先 */
function contentFor(post, platformId) {
  const ov = post.overrides && post.overrides[platformId];
  return (ov && ov.content) || post.content || '';
}

/**
 * 执行发布（只算结果、不写库，落盘交给调用方）
 * @returns {Promise<{results: Record<string, any>, anyOk: boolean, summary: string}>}
 */
async function publishPost(db, post, options = {}) {
  const platformIds = options.platforms && options.platforms.length ? options.platforms : post.platforms || [];
  const media = collectMedia(db, post);
  const results = {};

  if (!platformIds.length) {
    return { results, anyOk: false, summary: '这条内容还没有选择平台' };
  }

  for (const pid of platformIds) {
    const adapter = getAdapter(pid);

    // 未接入通道的平台 → 标记为待人工发布（不算失败，不污染统计）
    if (!adapter) {
      results[pid] = {
        status: 'pending_manual',
        message: '该平台需人工发布：文案已备好，去队列里复制即可',
        real: false,
        simulated: false,
        channelId: 'manual',
        at: new Date().toISOString(),
      };
      log.warn('未接入通道，标记为人工发布', { platform: pid, postId: post.id });
      continue;
    }

    const account = (db.accounts || []).find((a) => a.platformId === pid && a.connected && a.credential);
    if (!account) {
      results[pid] = {
        status: 'failed',
        message: '未连接账号 / 缺少凭证（去「账号管理」填写后即可自动发布）',
        real: true,
        simulated: false,
        channelId: adapter.id,
        at: new Date().toISOString(),
      };
      log.warn('缺少凭证，已标记失败', { platform: pid, postId: post.id, channel: adapter.id });
      continue;
    }

    const spec = platformMeta.get(pid);
    const ctx = {
      postId: post.id,
      platformId: pid,
      account: account.handle,
      accountId: account.id,
      content: contentFor(post, pid),
      hashtags: spec && spec.hashtag === false ? [] : post.hashtags || [],
      firstComment: post.firstComment || '',
      scheduledAt: post.scheduledAt || null,
      media,
      maxLength: spec ? spec.maxLength : 0,
    };

    const startedAt = Date.now();
    try {
      const res = await adapter.publish(ctx, account.credential);
      results[pid] = {
        status: res.ok ? 'published' : 'failed',
        message: res.message || '',
        externalId: res.externalId,
        real: true,
        simulated: !!res.simulated,
        channelId: adapter.id,
        ms: Date.now() - startedAt,
        at: new Date().toISOString(),
      };
      log[res.ok ? 'ok' : 'error'](`发布${res.ok ? '成功' : '失败'} · ${pid}`, {
        postId: post.id,
        channel: adapter.id,
        message: res.message,
        ms: Date.now() - startedAt,
      });
    } catch (e) {
      results[pid] = {
        status: 'failed',
        message: String((e && e.message) || e),
        real: true,
        simulated: false,
        channelId: adapter.id,
        at: new Date().toISOString(),
      };
      log.error(`发布异常 · ${pid}`, { postId: post.id, error: String(e && e.message) });
    }
  }

  const entries = Object.values(results);
  const okCount = entries.filter((r) => r.status === 'published').length;
  const anyOk = okCount > 0;
  const allOk = entries.length > 0 && okCount === entries.length;
  const anyManual = entries.some((r) => r.status === 'pending_manual');

  let summary;
  if (allOk) summary = `全部发布成功（${okCount}/${entries.length}）`;
  else if (anyOk) summary = `部分成功（${okCount}/${entries.length}）`;
  else if (anyManual) summary = '需人工发布';
  else summary = '发布失败';

  return { results, anyOk, allOk, summary };
}

/** 把发布结果合并回一条 Post */
function applyResults(post, results) {
  const entries = Object.values(results);
  const anyOk = entries.some((r) => r.status === 'published');
  const onlyManual = !anyOk && entries.length > 0 && entries.every((r) => r.status === 'pending_manual');

  const overrides = { ...(post.overrides || {}) };
  for (const [pid, r] of Object.entries(results)) {
    const published = r.status === 'published';
    overrides[pid] = {
      ...(overrides[pid] || {}),
      status: published ? 'published' : r.status === 'pending_manual' ? 'scheduled' : 'failed',
      error: published ? undefined : r.message,
      externalId: r.externalId,
      channel: r.channelId,
      at: r.at,
    };
    if (published) overrides[pid].publishedAt = r.at;
  }

  return {
    ...post,
    status: anyOk ? 'published' : onlyManual ? 'scheduled' : 'failed',
    publishedAt: anyOk ? new Date().toISOString() : post.publishedAt,
    overrides,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  publishPost,
  applyResults,
  collectMedia,
  contentFor,
  resolveLocalPath,
  channelMap,
};
