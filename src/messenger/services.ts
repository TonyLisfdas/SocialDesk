/**
 * 消息聚合 · 服务清单
 * ------------------------------------------------------------------
 * 思路跟 Ferdium / Franz / Rambox 一样：不调任何 API，
 * 就是把各家的**网页版**嵌进软件里 —— 登录的是你自己的账号，
 * 消息走官方网页，我们只负责「把窗口摆在一起」。
 *
 * 零 API、零密钥、零封号风险。
 */
export interface MsgService {
  id: string;
  nameZh: string;
  nameEn: string;
  /** 网页版地址 */
  url: string;
  /** 品牌色，用于图标底 */
  color: string;
  /** 图标里的字（没有官方 logo 资源时用字母） */
  glyph: string;
  /** 一句话说明，显示在空态/提示里 */
  noteZh: string;
  noteEn: string;
  /** 标记：更适合用桌面客户端（如 LINE） */
  clientUrl?: string;
}

export const SERVICES: MsgService[] = [
  {
    id: 'whatsapp',
    nameZh: 'WhatsApp',
    nameEn: 'WhatsApp',
    url: 'https://web.whatsapp.com/',
    color: '#25D366',
    glyph: 'WA',
    noteZh: '手机扫一次二维码即可，登录状态会保留',
    noteEn: 'Scan the QR code once with your phone; the session is kept',
  },
  {
    id: 'telegram',
    nameZh: 'Telegram',
    nameEn: 'Telegram',
    url: 'https://web.telegram.org/a/',
    color: '#2AABEE',
    glyph: 'TG',
    noteZh: '用手机号 + 验证码登录，或扫码',
    noteEn: 'Sign in with your phone number or QR code',
  },
  {
    id: 'messenger',
    nameZh: 'Messenger',
    nameEn: 'Messenger',
    url: 'https://www.messenger.com/',
    color: '#0084FF',
    glyph: 'ME',
    noteZh: '用 Facebook 账号登录',
    noteEn: 'Sign in with your Facebook account',
  },
  {
    id: 'instagram',
    nameZh: 'Instagram 私信',
    nameEn: 'Instagram DM',
    url: 'https://www.instagram.com/direct/inbox/',
    color: '#E1306C',
    glyph: 'IG',
    noteZh: '用 Instagram 账号登录',
    noteEn: 'Sign in with your Instagram account',
  },
  {
    id: 'discord',
    nameZh: 'Discord',
    nameEn: 'Discord',
    url: 'https://discord.com/app',
    color: '#5865F2',
    glyph: 'DC',
    noteZh: '网页版客户端，语音视频都可用',
    noteEn: 'Full web client including voice',
  },
  {
    id: 'slack',
    nameZh: 'Slack',
    nameEn: 'Slack',
    url: 'https://app.slack.com/client',
    color: '#4A154B',
    glyph: 'SL',
    noteZh: '输入工作区地址后用邮箱登录',
    noteEn: 'Enter your workspace URL, then sign in',
  },
  {
    id: 'line',
    nameZh: 'LINE',
    nameEn: 'LINE',
    url: 'https://web.line.me/',
    color: '#06C755',
    glyph: 'LN',
    noteZh: 'LINE 官方对网页版有限制；打不开就用下面的「打开 LINE 客户端」',
    noteEn: 'LINE restricts its web version; if it fails use "Open LINE app" below',
    clientUrl: 'line://',
  },
];

export const SERVICE_MAP: Record<string, MsgService> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s]),
);
