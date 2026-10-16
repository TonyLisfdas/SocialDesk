import type { DB, Post, PostStatus, MediaItem, Idea, InboxItem, Account } from '../types';
import { PLATFORMS } from '../platforms/registry';
import { uid, addDays, startOfDay, pickGradient } from './utils';

const SAMPLE_ZH = [
  '新品上线｜3 分钟讲清楚我们到底改了什么，附完整对比图 ⏱️',
  '客户最常问的 5 个问题，一次性回答（建议收藏）',
  '幕后：我们把注册流程从 7 步砍到 2 步的过程全记录',
  '这个价格我会买吗？三个身份各买了一遍（真实测评）',
  '团队周记｜本周踩的 4 个坑和 2 个小发现',
  '别再这样做落地页了：6 个改完转化率翻倍的细节',
  '一张图看懂 2026 的内容趋势',
  '用户说想要更简单，于是我们把首页删到只剩一个按钮',
  '从 0 到 1 做完一个品牌，我们学到的 8 件事',
  '今日份冷知识：这个功能的隐藏用法只有 0.1% 的人发现',
];

const SAMPLE_EN = [
  'We rebuilt onboarding from 7 steps to 2 — here is the full breakdown',
  '5 questions our customers ask us every single week',
  'Stop doing landing pages like this: 6 details that doubled conversion',
  'One chart that explains the 2026 content trend',
  'Behind the scenes: what really happens in a launch week',
  'We bought it three times so you do not have to — honest review',
];

const HASHTAGS = [
  ['产品', '干货', '效率'], ['SaaS', 'Growth', 'Startups'], ['小红书', '好物分享'],
  ['Marketing', 'Tips'], ['职场', '成长'], ['Tech', 'AI', 'Automation'],
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function buildSeed(): DB {
  const now = new Date();
  const posts: Post[] = [];
  const statuses: PostStatus[] = ['published', 'published', 'published', 'published', 'scheduled', 'scheduled', 'scheduled', 'draft', 'draft', 'published'];

  for (let i = 0; i < 46; i++) {
    const isEn = i % 3 === 0;
    const content = isEn ? pick(SAMPLE_EN, i) : pick(SAMPLE_ZH, i);
    const platformCount = 1 + (i % 3);
    const platforms = shuffle(PLATFORMS.filter((p) => (isEn ? p.group !== 'cn' : true)).map((p) => p.id)).slice(0, platformCount);
    const status = pick(statuses, i);
    const daysOffset = status === 'published' ? -(i % 55) - 1 : status === 'scheduled' ? (i % 17) + 1 : -(i % 4) - 1;
    const when = addDays(now, daysOffset);
    when.setHours(9 + (i % 10), (i * 7) % 60, 0, 0);
    const created = addDays(when, -2);
    posts.push({
      id: uid('post'),
      content,
      platforms,
      status,
      scheduledAt: status === 'scheduled' ? when.toISOString() : status === 'published' ? undefined : when.toISOString(),
      publishedAt: status === 'published' ? when.toISOString() : undefined,
      mediaIds: [],
      hashtags: pick(HASHTAGS, i),
      firstComment: platforms.some((p) => PLATFORMS.find((x) => x.id === p)?.features.firstComment) ? '链接放在这里 👇' : undefined,
      note: '',
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
  }

  const media: MediaItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: uid('media'),
    type: i % 4 === 3 ? 'video' : 'image',
    name: `素材 ${String(i + 1).padStart(2, '0')}`,
    gradient: pickGradient(`seed-${i}`),
    tags: [['产品', '截图'], ['封面'], ['教程'], ['活动'], ['模特'], ['风景'], ['数据图'], ['海报']][i % 8],
    createdAt: addDays(now, -(i % 20)).toISOString(),
    size: `${(0.3 + (i % 7) * 0.4).toFixed(1)} MB`,
  }));

  const ideas: Idea[] = [
    { id: uid('idea'), text: '做一期「我们踩过的 10 个坑」系列，每期讲一个', tags: ['系列'], source: '', createdAt: now.toISOString(), converted: false },
    { id: uid('idea'), text: '对比测评：同类产品 5 款，横向表格', tags: ['测评', '干货'], source: '', createdAt: now.toISOString(), converted: false },
    { id: uid('idea'), text: '客户访谈栏目第一期：找 3 个用户聊 30 分钟', tags: ['用户研究'], source: '', createdAt: now.toISOString(), converted: false },
    { id: uid('idea'), text: '把新功能做成「一分钟上手」短视频', tags: ['短视频'], source: '', createdAt: now.toISOString(), converted: false },
    { id: uid('idea'), text: '团队周记做成固定栏目，每周五发', tags: ['栏目'], source: '', createdAt: now.toISOString(), converted: false },
    { id: uid('idea'), text: '用 Notion 模板做一份「内容日历」分享给客户', tags: ['模板'], source: '', createdAt: now.toISOString(), converted: true },
  ];

  const inbox: InboxItem[] = [
    { id: uid('in'), platformId: 'xiaohongshu', account: '@brand_cn', type: 'comment', author: '小柠檬', body: '这个功能有免费版吗？想了解一下', at: addDays(now, 0).toISOString(), read: false, starred: false, replied: false },
    { id: uid('in'), platformId: 'xiaohongshu', account: '@brand_cn', type: 'comment', author: '王小鱼', body: '收藏了！请问支持团队协作吗？', at: addDays(now, -1).toISOString(), read: false, starred: true, replied: false },
    { id: uid('in'), platformId: 'douyin', account: '@brand_cn', type: 'comment', author: '路人甲', body: '求个链接', at: addDays(now, -1).toISOString(), read: true, starred: false, replied: false },
    { id: uid('in'), platformId: 'linkedin', account: '@brand_global', type: 'mention', author: 'Maria Chen', body: 'Great breakdown — we do something similar at Acme.', at: addDays(now, -2).toISOString(), read: false, starred: false, replied: false },
    { id: uid('in'), platformId: 'linkedin', account: '@brand_global', type: 'comment', author: 'Dev Patel', body: 'Which onboarding step did you drop first?', at: addDays(now, -2).toISOString(), read: true, starred: false, replied: true },
    { id: uid('in'), platformId: 'instagram', account: '@brand_global', type: 'dm', author: 'studio_nova', body: 'Hi! Could you share the deck?', at: addDays(now, -3).toISOString(), read: false, starred: true, replied: false },
    { id: uid('in'), platformId: 'x', account: '@brand_global', type: 'mention', author: '@techdaily', body: 'Nice thread on onboarding UX.', at: addDays(now, -3).toISOString(), read: true, starred: false, replied: false },
    { id: uid('in'), platformId: 'weibo', account: '@brand_cn', type: 'comment', author: '热评君', body: '什么时候出下一期？', at: addDays(now, -4).toISOString(), read: false, starred: false, replied: false },
  ];

  const accounts: Account[] = [];
  for (const p of PLATFORMS) {
    if (p.group === 'community' && p.id !== 'telegram') continue;
    const count = p.group === 'cn' ? 1 : 2;
    for (let i = 0; i < count; i++) {
      accounts.push({
        id: uid('acc'),
        platformId: p.id,
        handle: `@${p.id}${i ? '_2' : ''}`,
        displayName: p.group === 'cn' ? `${p.nameZh}官方` : `${p.nameEn} Brand`,
        connected: i === 0 && PLATFORMS.indexOf(p) % 3 !== 1,
        mode: p.connect,
        followers: 1200 + ((p.id.length * 977 + i * 431) % 88000),
      });
    }
  }

  return {
    version: 1,
    posts,
    media,
    ideas,
    inbox,
    accounts,
    settings: {
      lang: 'zh',
      theme: 'dark',
      hiddenPlatforms: [],
      weekStart: 1,
      timezone: 'Asia/Singapore',
      autoFirstComment: true,
      smartTime: true,
      brandVars: {
        品牌: 'Acme Studio',
        官网: 'https://example.com',
        签名: '—— Acme Studio 团队',
      },
    },
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function emptyDB(): DB {
  return {
    version: 1,
    posts: [],
    media: [],
    ideas: [],
    inbox: [],
    accounts: [],
    settings: {
      lang: 'zh',
      theme: 'dark',
      hiddenPlatforms: [],
      weekStart: 1,
      timezone: 'Asia/Singapore',
      autoFirstComment: true,
      smartTime: true,
      brandVars: {},
    },
  };
}

export function todayStart(): Date {
  return startOfDay(new Date());
}
