export type Lang = 'zh' | 'en';
export type PlatformGroup = 'cn' | 'global' | 'community';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type MediaType = 'image' | 'video';
export type ConnectMode = 'api' | 'cookie' | 'manual';

export interface PlatformFeatures {
  hashtag: boolean;
  firstComment: boolean;
  cover: boolean;
  thread: boolean;
  poll: boolean;
  location: boolean;
  tagPeople: boolean;
  linkInBody: boolean;
  altText: boolean;
  bestTime: boolean;
}

export interface PlatformSpec {
  id: string;
  nameZh: string;
  nameEn: string;
  glyph: string;
  group: PlatformGroup;
  color: string;
  maxLength: number;
  imageMax: number;
  videoMax: number;
  aspect: string;
  features: PlatformFeatures;
  connect: ConnectMode;
  bestTimes: string[];
  noteZh: string;
  noteEn: string;
}

export interface PlatformOverride {
  content?: string;
  scheduledAt?: string;
  publishedAt?: string;
  status?: PostStatus;
  error?: string;
  /** 发布成功后的外部 ID（如 Telegram message_id、Bluesky uri） */
  externalId?: string;
  /** 走的是哪条通道（telegram / bluesky / localbridge / webhook …） */
  channel?: string;
  /** 该平台最后一次发布动作的时间 */
  at?: string;
}

export interface Post {
  id: string;
  content: string;
  platforms: string[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  mediaIds: string[];
  hashtags: string[];
  firstComment?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  /** 自动发布失败后的重试次数（独立版引擎使用） */
  retries?: number;
  overrides?: Record<string, PlatformOverride>;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  /** 网络直链（浏览器版/独立版通用） */
  url?: string;
  /** 本地文件绝对路径 —— 只有独立版会有，发布时主进程直接读它上传 */
  path?: string;
  /** 独立版存的 MIME 类型 */
  mime?: string;
  /** 浏览器版内嵌的 base64（独立版不再使用，仅用于兼容旧数据） */
  dataUrl?: string;
  gradient: string;
  tags: string[];
  createdAt: string;
  size: string;
}

export interface Idea {
  id: string;
  text: string;
  tags: string[];
  source?: string;
  createdAt: string;
  converted: boolean;
}

export interface InboxItem {
  id: string;
  platformId: string;
  account: string;
  type: 'comment' | 'mention' | 'dm';
  author: string;
  body: string;
  at: string;
  read: boolean;
  starred: boolean;
  replied: boolean;
}

export interface Account {
  id: string;
  platformId: string;
  handle: string;
  displayName: string;
  connected: boolean;
  mode: ConnectMode;
  followers: number;
  note?: string;
  credential?: string;
}

export interface Settings {
  lang: Lang;
  theme: 'dark' | 'light';
  hiddenPlatforms: string[];
  weekStart: 0 | 1;
  timezone: string;
  autoFirstComment: boolean;
  smartTime: boolean;
  brandVars: Record<string, string>;
}

export interface DB {
  version: number;
  posts: Post[];
  media: MediaItem[];
  ideas: Idea[];
  inbox: InboxItem[];
  accounts: Account[];
  settings: Settings;
}

export interface Metrics {
  impressions: number;
  engagements: number;
  followersGained: number;
  clicks: number;
}
