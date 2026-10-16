import type { Post } from '../types';
import { PLATFORM_MAP } from '../platforms/registry';
import { addDays, startOfDay } from './utils';

export interface DayMetric {
  date: string;
  label: string;
  impressions: number;
  engagements: number;
  clicks: number;
  followers: number;
  posts: number;
}

export interface PlatformMetric {
  id: string;
  posts: number;
  impressions: number;
  engagements: number;
  clicks: number;
  followers: number;
  engRate: number;
}

export interface PostMetric {
  id: string;
  content: string;
  platformId: string;
  at: string;
  impressions: number;
  engagements: number;
  engRate: number;
}

/** 稳定的伪随机（同一个 key 永远得到同一个值），保证演示数据不跳动 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function postMetrics(post: Post): { impressions: number; engagements: number; clicks: number; followers: number } {
  const base = 800 + hash(post.id) * 12000;
  const mult = post.platforms.length * 0.7 + 1;
  const quality = 0.6 + hash(post.content) * 1.4;
  const impressions = Math.round(base * mult * quality);
  const engRate = 0.02 + hash(post.id + 'e') * 0.06;
  const engagements = Math.round(impressions * engRate);
  const clicks = Math.round(engagements * (0.15 + hash(post.id + 'c') * 0.35));
  const followers = Math.round(engagements * (0.08 + hash(post.id + 'f') * 0.25));
  return { impressions, engagements, clicks, followers };
}

export function buildSeries(posts: Post[], days: number): DayMetric[] {
  const today = startOfDay(new Date());
  const out: DayMetric[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = d.toISOString().slice(0, 10);
    const dayPosts = posts.filter((p) => {
      const at = p.publishedAt ?? p.scheduledAt;
      if (!at) return false;
      return new Date(at).toISOString().slice(0, 10) === key;
    });
    let impressions = 0;
    let engagements = 0;
    let clicks = 0;
    let followers = 0;
    for (const p of dayPosts) {
      const m = postMetrics(p);
      impressions += m.impressions;
      engagements += m.engagements;
      clicks += m.clicks;
      followers += m.followers;
    }
    // 自然流量：即使当天没发帖也有基础曝光
    const organic = Math.round(hash(key) * 900);
    out.push({
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      impressions: impressions + organic,
      engagements: engagements + Math.round(organic * 0.03),
      clicks: clicks + Math.round(organic * 0.008),
      followers: followers + Math.round(organic * 0.004),
      posts: dayPosts.length,
    });
  }
  return out;
}

export function buildPlatformMetrics(posts: Post[], days: number): PlatformMetric[] {
  const since = addDays(startOfDay(new Date()), -days).getTime();
  const map = new Map<string, PlatformMetric>();
  for (const p of posts) {
    const at = p.publishedAt ?? p.scheduledAt;
    if (!at || new Date(at).getTime() < since) continue;
    if (p.status !== 'published') continue;
    const m = postMetrics(p);
    for (const pid of p.platforms) {
      const cur = map.get(pid) ?? {
        id: pid, posts: 0, impressions: 0, engagements: 0, clicks: 0, followers: 0, engRate: 0,
      };
      cur.posts += 1;
      cur.impressions += Math.round(m.impressions / p.platforms.length);
      cur.engagements += Math.round(m.engagements / p.platforms.length);
      cur.clicks += Math.round(m.clicks / p.platforms.length);
      cur.followers += Math.round(m.followers / p.platforms.length);
      map.set(pid, cur);
    }
  }
  return Array.from(map.values())
    .map((m) => ({ ...m, engRate: m.impressions ? (m.engagements / m.impressions) * 100 : 0 }))
    .sort((a, b) => b.engagements - a.engagements);
}

export function buildTopPosts(posts: Post[], days: number, limit = 6): PostMetric[] {
  const since = addDays(startOfDay(new Date()), -days).getTime();
  return posts
    .filter((p) => {
      const at = p.publishedAt ?? p.scheduledAt;
      return p.status === 'published' && at && new Date(at).getTime() >= since;
    })
    .map((p) => {
      const m = postMetrics(p);
      return {
        id: p.id,
        content: p.content,
        platformId: p.platforms[0] ?? 'x',
        at: p.publishedAt ?? '',
        impressions: m.impressions,
        engagements: m.engagements,
        engRate: m.impressions ? (m.engagements / m.impressions) * 100 : 0,
      };
    })
    .sort((a, b) => b.engagements - a.engagements)
    .slice(0, limit);
}

/** 星期 × 小时 的效果热力图 */
export function buildHeatmap(posts: Post[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const counts: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const p of posts) {
    if (p.status !== 'published') continue;
    const at = p.publishedAt ?? p.scheduledAt;
    if (!at) continue;
    const d = new Date(at);
    const w = d.getDay();
    const h = d.getHours();
    const base = 0.25 + hash(p.id + w + h) * 0.75;
    grid[w][h] += base;
    counts[w][h] += 1;
  }
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      grid[w][h] = counts[w][h] ? grid[w][h] / counts[w][h] : 0.08 + hash(`${w}-${h}`) * 0.16;
    }
  }
  return grid;
}

export function platformColor(id: string): string {
  return PLATFORM_MAP[id]?.color ?? '#64748b';
}
