import { PLATFORM_MAP } from '../platforms/registry';
import { cn } from '../lib/utils';

export function PlatformIcon({
  id,
  size = 22,
  className,
  ring,
}: {
  id: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const p = PLATFORM_MAP[id];
  const color = p?.color ?? '#64748b';
  const fontSize = Math.max(8, Math.round(size * (p && p.glyph.length > 2 ? 0.33 : 0.44)));
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--sd-r-xs)] font-bold leading-none text-white select-none',
        ring && 'ring-brand',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${color}, ${shade(color, -18)})`,
        fontSize,
        letterSpacing: '-0.02em',
        boxShadow: ring ? `0 0 0 2px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
      }}
      title={p?.nameZh}
    >
      {p?.glyph ?? '?'}
    </span>
  );
}

function shade(hex: string, percent: number): string {
  const m = hex.replace('#', '');
  const num = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + percent));
  const b = Math.min(255, Math.max(0, (num & 255) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
