'use strict';
/**
 * 平台元数据（主进程侧的精简版）
 * 只保留发布时用得上的字段。完整规则（图数/比例/最佳时段…）在
 * 渲染进程的 src/platforms/registry.ts，那份是唯一事实来源，
 * 这里的 maxLength 保持与之同步即可。
 */
const META = {
  xiaohongshu: { maxLength: 1000, hashtag: true },
  douyin: { maxLength: 2200, hashtag: true },
  wechat_channels: { maxLength: 1000, hashtag: true },
  wechat_mp: { maxLength: 3000, hashtag: false },
  bilibili: { maxLength: 2000, hashtag: true },
  weibo: { maxLength: 2000, hashtag: true },
  zhihu: { maxLength: 5000, hashtag: false },
  kuaishou: { maxLength: 2000, hashtag: true },
  instagram: { maxLength: 2200, hashtag: true },
  facebook: { maxLength: 63206, hashtag: true },
  x: { maxLength: 280, hashtag: true },
  linkedin: { maxLength: 3000, hashtag: true },
  tiktok: { maxLength: 2200, hashtag: true },
  youtube: { maxLength: 5000, hashtag: true },
  threads: { maxLength: 500, hashtag: true },
  pinterest: { maxLength: 500, hashtag: true },
  google_business: { maxLength: 750, hashtag: false },
  kuaishou_gb: { maxLength: 2200, hashtag: true },
  reddit: { maxLength: 40000, hashtag: false },
  telegram: { maxLength: 4096, hashtag: true },
  discord: { maxLength: 2000, hashtag: false },
  whatsapp: { maxLength: 4096, hashtag: false },
  bluesky: { maxLength: 300, hashtag: true },
  mastodon: { maxLength: 500, hashtag: true },
};

module.exports = {
  META,
  get: (id) => META[id] || null,
};
