'use strict';
/**
 * 发布适配器注册表（运行在 Electron 主进程 = 真正的 Node 环境）
 *
 * 与浏览器版最大的区别：这里跑的是真正的 Node 网络请求，
 * 没有跨域限制、没有沙箱，还能读写本地素材文件，
 * 所以能做到浏览器做不到的事：直接上传磁盘上的图片、常驻后台定时发。
 *
 * 每个适配器实现：
 *   id / label / mode / credentialHint / real
 *   test(credential)             -> { ok, message }
 *   publish(ctx, credential)     -> { ok, message, externalId? }
 */
const telegram = require('./telegram.cjs');
const bluesky = require('./bluesky.cjs');
const discord = require('./discord.cjs');
const mastodon = require('./mastodon.cjs');
const webhook = require('./webhook.cjs');
const localbridge = require('./localbridge.cjs');
const shared = require('./_shared.cjs');

const ALL = [telegram, bluesky, discord, mastodon, webhook, localbridge];

/** platformId -> 适配器（键必须与 src/platforms/registry.ts 中的 id 完全一致） */
const BY_PLATFORM = {
  // —— 开箱即用的真实通道（无需自建服务）——
  telegram,
  bluesky,
  discord,
  mastodon,
  // —— 国内平台：统一走本机 Python 桥（cookie 会话发布）——
  xiaohongshu: localbridge,
  douyin: localbridge,
  wechat_channels: localbridge,
  bilibili: localbridge,
  kuaishou: localbridge,
  zhihu: localbridge,
  weibo: localbridge,
  tiktok: localbridge,
  // —— 需要 OAuth 的海外平台：交给用户自建的中转服务 ——
  threads: webhook,
  linkedin: webhook,
  instagram: webhook,
  facebook: webhook,
  youtube: webhook,
  pinterest: webhook,
  x: webhook,
  reddit: webhook,
  whatsapp: webhook,
  kuaishou_gb: webhook,
  google_business: webhook,
  // —— 微信公众号：官方接口要企业认证，默认人工 ——
  wechat_mp: null,
};

function getAdapter(platformId) {
  return BY_PLATFORM[platformId] || null;
}

function isRealPlatform(platformId) {
  const a = getAdapter(platformId);
  return !!a && a.real !== false;
}

/** 平台上所有「走真实通道」的 id —— 渲染进程也用它来判断徽标 */
function realPlatformIds() {
  return Object.keys(BY_PLATFORM).filter((pid) => isRealPlatform(pid));
}

/** 平台 -> 通道 id，用于界面提示「这个平台会走哪条路」 */
function channelMap() {
  const out = {};
  for (const [pid, a] of Object.entries(BY_PLATFORM)) out[pid] = a ? a.id : 'manual';
  return out;
}

/** 给界面用的适配器说明清单（不含内部函数） */
function describe() {
  return ALL.map((a) => ({
    id: a.id,
    label: a.label,
    mode: a.mode,
    credentialHint: a.credentialHint,
    helpZh: a.helpZh,
    helpEn: a.helpEn,
    real: a.real !== false,
  }));
}

module.exports = {
  ALL,
  BY_PLATFORM,
  getAdapter,
  isRealPlatform,
  realPlatformIds,
  channelMap,
  describe,
  ...shared,
};
