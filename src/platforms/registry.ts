import type { PlatformSpec, ConnectMode } from '../types';

/**
 * 平台注册表 —— 每个平台是一个可独立启用/隐藏的「适配器模块」。
 * 规则数据（字数上限、图片数量、宽高比、发布方式）来自各平台公开文档整理，
 * 发布方式分三类：
 *   api    —— 有官方开放 API，填 token 即可真实发布
 *   cookie —— 国内平台（小红书/抖音/视频号等）没有开放 API，
 *             业界通行方案是 cookie 模拟登录（参考 MIT 协议项目 social-auto-upload）
 *   manual —— 无 API 且不自动化，工作台负责排期 + 一键复制文案，人工粘贴发布
 */
export const PLATFORMS: PlatformSpec[] = [
  /* ---------------- 国内平台 ---------------- */
  {
    id: 'xiaohongshu', nameZh: '小红书', nameEn: 'RedNote', glyph: 'RED', group: 'cn', color: '#FF2442',
    maxLength: 1000, imageMax: 18, videoMax: 1, aspect: '3:4',
    features: { hashtag: true, firstComment: true, cover: true, thread: false, poll: false, location: true, tagPeople: true, linkInBody: false, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['12:00', '19:30', '21:00'],
    noteZh: '无开放 API，需用「网页版扫码登录」拿到的 cookie 模拟发布；正文 1000 字，支持 18 图 / 1 视频，标题 ≤20 字、封面单独设置。',
    noteEn: 'No public API. Publish via web-session cookie (see MIT project social-auto-upload). Body ≤1000 chars, up to 18 images / 1 video.',
  },
  {
    id: 'douyin', nameZh: '抖音', nameEn: 'Douyin', glyph: '抖', group: 'cn', color: '#FE2C55',
    maxLength: 2200, imageMax: 9, videoMax: 1, aspect: '9:16',
    features: { hashtag: true, firstComment: false, cover: true, thread: false, poll: true, location: true, tagPeople: true, linkInBody: false, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['12:30', '18:00', '21:30'],
    noteZh: '无开放 API，cookie 模拟发布。竖版 9:16 最佳，标题 30 字以内，话题标签计 55 字。',
    noteEn: 'No public API, cookie-based publishing. Best ratio 9:16, title ≤30 chars, hashtags count toward 55 chars.',
  },
  {
    id: 'wechat_channels', nameZh: '视频号', nameEn: 'WeChat Channels', glyph: '视', group: 'cn', color: '#07C160',
    maxLength: 1000, imageMax: 9, videoMax: 1, aspect: '9:16',
    features: { hashtag: true, firstComment: false, cover: true, thread: false, poll: false, location: true, tagPeople: false, linkInBody: false, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['07:30', '12:00', '20:00'],
    noteZh: '无开放 API，cookie 模拟发布。描述 1000 字，9:16 竖版，公众号后台可绑定转发。',
    noteEn: 'No public API, cookie-based publishing. Description ≤1000 chars, 9:16 vertical.',
  },
  {
    id: 'wechat_mp', nameZh: '公众号', nameEn: 'WeChat MP', glyph: '公', group: 'cn', color: '#2BA245',
    maxLength: 3000, imageMax: 20, videoMax: 1, aspect: '2.35:1',
    features: { hashtag: false, firstComment: false, cover: true, thread: false, poll: false, location: true, tagPeople: false, linkInBody: true, altText: true, bestTime: true },
    connect: 'manual', bestTimes: ['07:00', '12:30', '21:00'],
    noteZh: '需公众号后台「素材管理 → 草稿箱」同步，或走 公众号 API（需 AppID/Secret）。正文建议 ≤1500 字，摘要 120 字。',
    noteEn: 'Sync via the MP backend draft box, or use the official API (AppID/Secret). Body recommended ≤1500 chars.',
  },
  {
    id: 'bilibili', nameZh: '哔哩哔哩', nameEn: 'Bilibili', glyph: 'B', group: 'cn', color: '#00A1D6',
    maxLength: 2000, imageMax: 9, videoMax: 1, aspect: '16:9',
    features: { hashtag: true, firstComment: false, cover: true, thread: false, poll: false, location: false, tagPeople: true, linkInBody: true, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['11:00', '19:00', '22:00'],
    noteZh: '无开放 API，cookie 模拟发布。标题 ≤80 字，简介 2000 字，稿件类型可选视频/专栏/动态。',
    noteEn: 'No public API, cookie-based publishing. Title ≤80 chars, description 2000 chars.',
  },
  {
    id: 'weibo', nameZh: '微博', nameEn: 'Weibo', glyph: '微', group: 'cn', color: '#E6162D',
    maxLength: 2000, imageMax: 9, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: false, cover: false, thread: false, poll: false, location: true, tagPeople: true, linkInBody: true, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['08:00', '12:30', '22:00'],
    noteZh: '有开放 API（微博开放平台，需企业/开发者资质）。正文 2000 字，超出折叠为长文。',
    noteEn: 'Official API available via Weibo Open Platform (developer approval required). Body 2000 chars.',
  },
  {
    id: 'zhihu', nameZh: '知乎', nameEn: 'Zhihu', glyph: '知', group: 'cn', color: '#0084FF',
    maxLength: 5000, imageMax: 20, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: false, cover: false, thread: false, poll: false, location: false, tagPeople: false, linkInBody: true, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['08:30', '12:00', '21:30'],
    noteZh: '无开放 API，cookie 模拟发布。回答/文章支持富文本，图片多图排版。',
    noteEn: 'No public API, cookie-based publishing. Rich text answers and articles supported.',
  },
  {
    id: 'kuaishou', nameZh: '快手', nameEn: 'Kuaishou', glyph: '快', group: 'cn', color: '#FF6600',
    maxLength: 2000, imageMax: 9, videoMax: 1, aspect: '9:16',
    features: { hashtag: true, firstComment: false, cover: true, thread: false, poll: false, location: true, tagPeople: false, linkInBody: false, altText: false, bestTime: true },
    connect: 'cookie', bestTimes: ['12:00', '18:30', '21:00'],
    noteZh: '无开放 API，cookie 模拟发布。9:16 竖版优先。',
    noteEn: 'No public API, cookie-based publishing. 9:16 vertical preferred.',
  },

  /* ---------------- 海外主流 ---------------- */
  {
    id: 'instagram', nameZh: 'Instagram', nameEn: 'Instagram', glyph: 'IG', group: 'global', color: '#E4405F',
    maxLength: 2200, imageMax: 10, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: true, cover: false, thread: false, poll: false, location: true, tagPeople: true, linkInBody: false, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['09:00', '13:00', '19:00'],
    noteZh: '走 Instagram Graph API（需 Facebook 主页/专业账号）。图集最多 10 张，首评可带链接。',
    noteEn: 'Instagram Graph API (business/professional account). Carousel up to 10 items, first comment can carry links.',
  },
  {
    id: 'facebook', nameZh: 'Facebook', nameEn: 'Facebook', glyph: 'f', group: 'global', color: '#1877F2',
    maxLength: 63206, imageMax: 10, videoMax: 1, aspect: '1.91:1',
    features: { hashtag: true, firstComment: true, cover: false, thread: false, poll: true, location: true, tagPeople: true, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['09:00', '13:00', '20:00'],
    noteZh: 'Graph API + Page Access Token。帖子/群组/主页均可发布，支持定时与首评。',
    noteEn: 'Graph API with Page Access Token. Supports pages, groups, scheduling and first comments.',
  },
  {
    id: 'x', nameZh: 'X (Twitter)', nameEn: 'X (Twitter)', glyph: '𝕏', group: 'global', color: '#71767B',
    maxLength: 280, imageMax: 4, videoMax: 1, aspect: '16:9',
    features: { hashtag: true, firstComment: true, cover: false, thread: true, poll: true, location: true, tagPeople: true, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['09:00', '12:00', '19:00'],
    noteZh: '标准 280 字；Premium 可到 25,000 字。支持长推串（thread）、投票、话题。',
    noteEn: '280 chars standard (25,000 with Premium). Threads, polls and hashtags supported.',
  },
  {
    id: 'linkedin', nameZh: 'LinkedIn', nameEn: 'LinkedIn', glyph: 'in', group: 'global', color: '#0A66C2',
    maxLength: 3000, imageMax: 9, videoMax: 1, aspect: '1.91:1',
    features: { hashtag: true, firstComment: true, cover: false, thread: false, poll: false, location: true, tagPeople: true, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['08:00', '12:00', '18:00'],
    noteZh: '官方 API 可发个人主页 / 公司页 / 组织页。首评策略（链接放首评）能显著提升点击。',
    noteEn: 'Official API for personal, company and organisation pages. Link-in-first-comment boosts clicks.',
  },
  {
    id: 'tiktok', nameZh: 'TikTok', nameEn: 'TikTok', glyph: 'TT', group: 'global', color: '#FE2C55',
    maxLength: 2200, imageMax: 35, videoMax: 1, aspect: '9:16',
    features: { hashtag: true, firstComment: true, cover: true, thread: false, poll: false, location: true, tagPeople: true, linkInBody: false, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['11:00', '15:00', '21:00'],
    noteZh: 'Content Posting API 需审核通过（企业开发者）。9:16 竖版、字幕前 3 秒是留存关键。',
    noteEn: 'Content Posting API requires business review approval. 9:16 vertical, hook in first 3 seconds.',
  },
  {
    id: 'youtube', nameZh: 'YouTube', nameEn: 'YouTube', glyph: 'YT', group: 'global', color: '#FF0000',
    maxLength: 5000, imageMax: 1, videoMax: 1, aspect: '16:9',
    features: { hashtag: false, firstComment: true, cover: true, thread: false, poll: false, location: true, tagPeople: false, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '16:00', '20:00'],
    noteZh: 'YouTube Data API v3 可上传并定时发布（公开/未公开均可）。标题 ≤100 字，描述 5000 字。',
    noteEn: 'YouTube Data API v3 supports upload + scheduled publish. Title ≤100 chars, description 5000 chars.',
  },
  {
    id: 'threads', nameZh: 'Threads', nameEn: 'Threads', glyph: 'Th', group: 'global', color: '#8A8A8A',
    maxLength: 500, imageMax: 20, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: true, cover: false, thread: false, poll: false, location: true, tagPeople: true, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '14:00', '20:00'],
    noteZh: 'Threads API 正式开放，可发布文本/图片/视频。500 字上限。',
    noteEn: 'Threads API is generally available for text, image and video posts. 500 char limit.',
  },
  {
    id: 'pinterest', nameZh: 'Pinterest', nameEn: 'Pinterest', glyph: 'P', group: 'global', color: '#E60023',
    maxLength: 500, imageMax: 5, videoMax: 1, aspect: '2:3',
    features: { hashtag: true, firstComment: false, cover: false, thread: false, poll: false, location: true, tagPeople: false, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '15:00', '21:00'],
    noteZh: 'Pinterest API v5 可发 Pin。竖版 2:3 点击率最高，标题 100 字，描述 800 字。',
    noteEn: 'Pinterest API v5. 2:3 vertical pins get the highest CTR.',
  },
  {
    id: 'google_business', nameZh: 'Google 商家', nameEn: 'Google Business', glyph: 'G', group: 'global', color: '#4285F4',
    maxLength: 750, imageMax: 10, videoMax: 1, aspect: '1:1',
    features: { hashtag: false, firstComment: false, cover: false, thread: false, poll: false, location: true, tagPeople: false, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['09:00', '12:00', '18:00'],
    noteZh: 'Google Business Profile API 可发帖子/商品/活动。帖子正文 750 字，链接按钮单独设置。',
    noteEn: 'Google Business Profile API for posts, products and events. 750 char post limit.',
  },
  {
    id: 'kuaishou_gb', nameZh: 'TikTok 全球版', nameEn: 'TikTok Global', glyph: 'Tk', group: 'global', color: '#25F4EE',
    maxLength: 2200, imageMax: 35, videoMax: 1, aspect: '9:16',
    features: { hashtag: true, firstComment: true, cover: true, thread: false, poll: false, location: true, tagPeople: true, linkInBody: false, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['11:00', '15:00', '21:00'],
    noteZh: '与抖音分开的海外账号位，便于对比国内 / 海外内容策略。',
    noteEn: 'Separate account slot so you can compare CN vs global content strategy.',
  },

  /* ---------------- 社区 / 私域 ---------------- */
  {
    id: 'reddit', nameZh: 'Reddit', nameEn: 'Reddit', glyph: 'R/', group: 'community', color: '#FF4500',
    maxLength: 40000, imageMax: 1, videoMax: 1, aspect: '16:9',
    features: { hashtag: false, firstComment: false, cover: false, thread: false, poll: false, location: false, tagPeople: true, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['07:00', '12:00', '17:00'],
    noteZh: 'Reddit API 按 subreddit 授权。注意社区规则（自推广限制），建议错峰发布。',
    noteEn: 'Reddit API is per-subreddit. Mind the rules on self-promotion, post off-peak.',
  },
  {
    id: 'telegram', nameZh: 'Telegram', nameEn: 'Telegram', glyph: 'TG', group: 'community', color: '#2AABEE',
    maxLength: 4096, imageMax: 10, videoMax: 1, aspect: '16:9',
    features: { hashtag: true, firstComment: false, cover: false, thread: false, poll: true, location: true, tagPeople: false, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['09:00', '13:00', '20:00'],
    noteZh: '用 Bot API 的 sendMessage / sendPhoto / sendMediaGroup，最稳最省心。凭证格式：<botToken>|<chatId>，填好后可直接真实发布。',
    noteEn: 'Bot API: sendMessage / sendPhoto / sendMediaGroup. Credential format: <botToken>|<chatId>. Already wired for real publishing.',
  },
  {
    id: 'discord', nameZh: 'Discord', nameEn: 'Discord', glyph: 'DC', group: 'community', color: '#5865F2',
    maxLength: 2000, imageMax: 10, videoMax: 1, aspect: '16:9',
    features: { hashtag: false, firstComment: false, cover: false, thread: false, poll: false, location: false, tagPeople: true, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['18:00', '20:00', '22:00'],
    noteZh: '用 Webhook 或 Bot 推送频道消息，可指定多个频道。',
    noteEn: 'Push via Webhook or Bot to one or many channels.',
  },
  {
    id: 'whatsapp', nameZh: 'WhatsApp', nameEn: 'WhatsApp', glyph: 'WA', group: 'community', color: '#25D366',
    maxLength: 4096, imageMax: 10, videoMax: 1, aspect: '1:1',
    features: { hashtag: false, firstComment: false, cover: false, thread: false, poll: false, location: true, tagPeople: false, linkInBody: true, altText: false, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '14:00', '19:00'],
    noteZh: 'WhatsApp Business Cloud API，适合客服与私域通知。',
    noteEn: 'WhatsApp Business Cloud API for customer service and private-domain notices.',
  },
  {
    id: 'bluesky', nameZh: 'Bluesky', nameEn: 'Bluesky', glyph: 'BS', group: 'community', color: '#0085FF',
    maxLength: 300, imageMax: 4, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: false, cover: false, thread: true, poll: false, location: true, tagPeople: true, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '17:00', '22:00'],
    noteZh: 'AT Protocol 免费开放，300 字符。凭证格式：<handle>|<appPassword>，填好后可直接真实发布。',
    noteEn: 'Open AT Protocol, 300 chars. Credential format: <handle>|<appPassword>. Already wired for real publishing.',
  },
  {
    id: 'mastodon', nameZh: 'Mastodon', nameEn: 'Mastodon', glyph: 'M', group: 'community', color: '#6364FF',
    maxLength: 500, imageMax: 4, videoMax: 1, aspect: '1:1',
    features: { hashtag: true, firstComment: false, cover: false, thread: true, poll: false, location: true, tagPeople: true, linkInBody: true, altText: true, bestTime: true },
    connect: 'api', bestTimes: ['10:00', '17:00', '22:00'],
    noteZh: '各实例规则不同，联邦账号之间互不相通。500 字符。',
    noteEn: 'Rules differ per instance; federation is not universal. 500 chars.',
  },
];

export const PLATFORM_MAP: Record<string, PlatformSpec> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p]),
);

export const GROUP_LABEL: Record<string, { zh: string; en: string }> = {
  cn: { zh: '国内平台', en: 'China' },
  global: { zh: '海外主流', en: 'Global' },
  community: { zh: '社区 / 私域', en: 'Community' },
};

export const CONNECT_LABEL: Record<ConnectMode, { zh: string; en: string; hintZh: string; hintEn: string }> = {
  api: {
    zh: '官方 API', en: 'Official API',
    hintZh: '在「账号管理」填入 API Token / App 凭证即可真实发布。',
    hintEn: 'Add an API token in Accounts to enable real publishing.',
  },
  cookie: {
    zh: 'Cookie 模拟', en: 'Cookie session',
    hintZh: '该平台没有开放 API。方案：扫码登录网页版 → 抓取 cookie → 本地保存（参考 MIT 项目 social-auto-upload）。',
    hintEn: 'No public API for this platform. Use a scanned web-session cookie (see MIT project social-auto-upload).',
  },
  manual: {
    zh: '人工发布', en: 'Manual',
    hintZh: '工作台负责排期与素材管理，发布时一键复制文案，人工粘贴到平台后台。',
    hintEn: 'The desk plans and prepares everything; you copy the text and paste it into the platform.',
  },
};

export const ASPECT_PRESETS = [
  '1:1', '3:4', '2:3', '4:5', '9:16', '16:9', '2.35:1', '1.91:1', '1.5:1', 'free',
];
