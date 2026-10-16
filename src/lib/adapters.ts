import type { Account, ConnectMode } from '../types';
import { PLATFORM_MAP } from '../platforms/registry';
import { uid } from './utils';
import bridge from './bridge';

/**
 * 发布适配器层
 * ---------------------------------------------------------------
 * 每个平台一个 Adapter，负责「连接测试」与「发布」。当前内置
 * DemoAdapter：不发真实请求，只按平台的接入方式返回可信的结果，
 * 便于先把工作台跑通；接真实 API 时只需要把对应平台的
 * adapter 换成 fetch 实现即可，UI 层无需改动。
 */

export interface PublishTarget {
  platformId: string;
  accountId?: string;
  content: string;
  mediaUrls: string[];
  scheduledAt?: string;
  firstComment?: string;
  hashtags: string[];
}

export interface PublishResult {
  ok: boolean;
  mode: ConnectMode;
  message: string;
  simulated: boolean;
  externalId?: string;
}

export interface PublishAdapter {
  platformId: string;
  mode: ConnectMode;
  testConnection(credential: string): Promise<PublishResult>;
  publish(target: PublishTarget, credential: string): Promise<PublishResult>;
}

const MESSAGES: Record<ConnectMode, { zh: string; en: string }> = {
  api: {
    zh: '已通过官方 API 发布',
    en: 'Published via official API',
  },
  cookie: {
    zh: '已通过网页会话 cookie 发布（请确保登录态有效）',
    en: 'Published via web-session cookie (make sure the session is alive)',
  },
  manual: {
    zh: '该平台需人工发布：文案已准备好，复制后粘贴到平台后台即可',
    en: 'Manual platform: text is ready — copy and paste it into the platform',
  },
};

export class DemoAdapter implements PublishAdapter {
  platformId: string;
  mode: ConnectMode;
  constructor(platformId: string, mode: ConnectMode) {
    this.platformId = platformId;
    this.mode = mode;
  }
  async testConnection(credential: string): Promise<PublishResult> {
    await sleep(500);
    const has = credential.trim().length > 0;
    return {
      ok: has,
      mode: this.mode,
      simulated: true,
      message: has
        ? '连接成功（演示）'
        : '缺少凭证，请在下方粘贴 Token / App 凭证',
    };
  }
  async publish(target: PublishTarget, _credential: string): Promise<PublishResult> {
    await sleep(600 + Math.random() * 500);
    const p = PLATFORM_MAP[target.platformId];
    const over = p ? target.content.length > p.maxLength : false;
    return {
      ok: !over,
      mode: this.mode,
      simulated: true,
      externalId: uid('pub'),
      message: over
        ? `内容超出 ${p?.maxLength} 字上限，已标记为失败`
        : MESSAGES[this.mode].zh,
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const registry = new Map<string, PublishAdapter>();

/* ===================================================================
 * 真实发布适配器（已实现，可直接用）
 * =================================================================== */

/** Telegram Bot API —— 最简单的真实发布通道
 *  凭证格式： <botToken>|<chatId>   例：123456:AAHxxxxx|-1001234567890
 */
export class TelegramAdapter implements PublishAdapter {
  platformId = 'telegram';
  mode: ConnectMode = 'api';

  private parse(credential: string) {
    const raw = credential.trim();
    const idx = raw.lastIndexOf('|');
    if (idx <= 0) return null;
    return { token: raw.slice(0, idx).trim(), chatId: raw.slice(idx + 1).trim() };
  }

  async testConnection(credential: string): Promise<PublishResult> {
    const p = this.parse(credential);
    if (!p) {
      return { ok: false, mode: 'api', simulated: false, message: '凭证格式应为 <botToken>|<chatId>' };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${p.token}/getMe`);
      const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
      return {
        ok: !!json.ok,
        mode: 'api',
        simulated: false,
        message: json.ok ? `连接成功：@${json.result?.username ?? 'bot'}` : 'Token 无效或网络不可达',
      };
    } catch (e) {
      return { ok: false, mode: 'api', simulated: false, message: `网络请求失败：${(e as Error).message}` };
    }
  }

  async publish(target: PublishTarget, credential: string): Promise<PublishResult> {
    const p = this.parse(credential);
    if (!p) {
      return { ok: false, mode: 'api', simulated: false, message: '缺少凭证（<botToken>|<chatId>）' };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${p.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: p.chatId,
          text: target.content,
          disable_web_page_preview: false,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
      return {
        ok: !!json.ok,
        mode: 'api',
        simulated: false,
        externalId: String(json.result?.message_id ?? ''),
        message: json.ok ? '已通过 Telegram Bot API 发布' : '发送失败',
      };
    } catch (e) {
      return { ok: false, mode: 'api', simulated: false, message: `网络请求失败：${(e as Error).message}` };
    }
  }
}

/** Bluesky (AT Protocol) —— 官方免费开放
 *  凭证格式： <handle>|<appPassword>   例：me.bsky.social|xxxx-xxxx-xxxx
 */
export class BlueskyAdapter implements PublishAdapter {
  platformId = 'bluesky';
  mode: ConnectMode = 'api';

  private parse(credential: string) {
    const raw = credential.trim();
    const idx = raw.indexOf('|');
    if (idx <= 0) return null;
    return { handle: raw.slice(0, idx).trim(), password: raw.slice(idx + 1).trim() };
  }

  private async session(identifier: string, password: string) {
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = (await res.json()) as { accessJwt?: string; did?: string };
    if (!json.accessJwt) throw new Error('登录失败：账号或 App Password 不正确');
    return json;
  }

  async testConnection(credential: string): Promise<PublishResult> {
    const p = this.parse(credential);
    if (!p) {
      return { ok: false, mode: 'api', simulated: false, message: '凭证格式应为 <handle>|<appPassword>' };
    }
    try {
      const s = await this.session(p.handle, p.password);
      return { ok: true, mode: 'api', simulated: false, message: `连接成功：${s.did}` };
    } catch (e) {
      return { ok: false, mode: 'api', simulated: false, message: (e as Error).message };
    }
  }

  async publish(target: PublishTarget, credential: string): Promise<PublishResult> {
    const p = this.parse(credential);
    if (!p) {
      return { ok: false, mode: 'api', simulated: false, message: '缺少凭证（<handle>|<appPassword>）' };
    }
    try {
      const s = await this.session(p.handle, p.password);
      const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessJwt}` },
        body: JSON.stringify({
          repo: s.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: target.content.slice(0, 300),
            createdAt: new Date().toISOString(),
          },
        }),
      });
      const json = (await res.json()) as { uri?: string };
      return {
        ok: !!json.uri,
        mode: 'api',
        simulated: false,
        externalId: json.uri,
        message: json.uri ? '已通过 AT Protocol 发布' : '发布失败',
      };
    } catch (e) {
      return { ok: false, mode: 'api', simulated: false, message: `发布失败：${(e as Error).message}` };
    }
  }
}

/* ------------------------------------------------------------------ */

const REAL_ADAPTERS: Record<string, () => PublishAdapter> = {
  telegram: () => new TelegramAdapter(),
  bluesky: () => new BlueskyAdapter(),
};

export function getAdapter(platformId: string): PublishAdapter {
  const found = registry.get(platformId);
  if (found) return found;
  const spec = PLATFORM_MAP[platformId];
  const factory = REAL_ADAPTERS[platformId];
  const adapter = factory ? factory() : new DemoAdapter(platformId, spec?.connect ?? 'manual');
  registry.set(platformId, adapter);
  return adapter;
}

/** 该平台是否已接入真实发布通道 */
export function isRealAdapter(platformId: string): boolean {
  return platformId in REAL_ADAPTERS;
}

export function registerAdapter(adapter: PublishAdapter): void {
  registry.set(adapter.platformId, adapter);
}

/* ===================================================================
 * 独立版（Electron）路由
 * -------------------------------------------------------------------
 * 检测到运行在桌面端时：
 *   · 连接测试 → 主进程真发一次 API 请求
 *   · 立即发布 → 主进程执行，支持本地素材文件直传
 * 跑在浏览器里时自动退回上面的 DemoAdapter，保证同一份界面两边都能用。
 * =================================================================== */

/** 该平台在独立版里是否有真实通道（主进程 channelMap 为准） */
export function isRealInDesktop(platformId: string, channelMap: Record<string, string> | null | undefined): boolean {
  if (!channelMap) return false;
  return channelMap[platformId] === 'telegram'
    || channelMap[platformId] === 'bluesky'
    || channelMap[platformId] === 'discord'
    || channelMap[platformId] === 'mastodon'
    || channelMap[platformId] === 'webhook'
    || channelMap[platformId] === 'localbridge';
}

/** 通过主进程测试连接（桌面端专用） */
export async function testConnectionReal(
  platformId: string,
  credential: string,
): Promise<PublishResult | null> {
  if (!bridge.isDesktop) return null;
  const r = await bridge.testConnection(platformId, credential);
  if (!r) return null;
  return {
    ok: r.ok,
    mode: PLATFORM_MAP[platformId]?.connect ?? 'api',
    simulated: false,
    message: r.message,
  };
}

export function defaultAccount(platformId: string, idx = 0): Account {
  const p = PLATFORM_MAP[platformId];
  return {
    id: uid('acc'),
    platformId,
    handle: p ? `@${p.id}_${idx + 1}` : '@account',
    displayName: p ? (p.nameZh.length > 6 ? p.nameZh.slice(0, 6) : p.nameZh) : 'Account',
    connected: false,
    mode: p?.connect ?? 'manual',
    followers: 0,
  };
}
