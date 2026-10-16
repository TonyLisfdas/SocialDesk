import clsx from 'clsx';
import type { ClassValue } from 'clsx';

export const cn = (...args: ClassValue[]) => clsx(...args);

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function monthMatrix(year: number, month: number, weekStart: 0 | 1): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function fmtDate(iso: string | undefined, lang: 'zh' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return lang === 'zh' ? `${d.getFullYear()}/${mm}/${dd} ${hh}:${mi}` : `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

export function fmtDay(iso: string | undefined, lang: 'zh' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return lang === 'zh' ? `${mm}/${dd}` : `${mm}-${dd}`;
}

export function fmtTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function relativeTime(iso: string, lang: 'zh' | 'en'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (m < 60) return lang === 'zh' ? `${m} 分钟前` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'zh' ? `${h} 小时前` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang === 'zh' ? `${d} 天前` : `${d}d ago`;
  return fmtDate(iso, lang);
}

export function fmtNumber(n: number, lang: 'zh' | 'en'): string {
  if (lang === 'zh') {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}w`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(Math.round(n));
  }
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function extractHashtags(text: string): string[] {
  const out: string[] = [];
  const re = /#([^\s#.,!?，。！？]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

export function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (m, key) => {
    const k = String(key).trim();
    return vars[k] !== undefined && vars[k] !== '' ? vars[k] : m;
  });
}

export function unresolvedVars(text: string, vars: Record<string, string>): string[] {
  const out: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const k = String(m[1]).trim();
    if (vars[k] === undefined || vars[k] === '') out.push(k);
  }
  return Array.from(new Set(out));
}

export function hasMedia(text: string): boolean {
  return /\.(png|jpe?g|gif|webp|mp4|mov|webm)(\?|$)/i.test(text);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadFile(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function weekdayLabel(d: Date, lang: 'zh' | 'en'): string {
  const zh = ['日', '一', '二', '三', '四', '五', '六'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return lang === 'zh' ? `周${zh[d.getDay()]}` : en[d.getDay()];
}

export const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#14b8a6,#06b6d4)',
];

export function pickGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}
