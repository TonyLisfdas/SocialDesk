import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/* =====================================================================
   尺寸规范（全站统一，改这里就全站生效）
   按钮三档：sm 32px / md 40px / lg 48px
   纯图标按钮：正方形，同三档
   所有按钮命中区自动补到 ≥44px（.hit）
   ===================================================================== */

type BtnSize = 'sm' | 'md' | 'lg';
type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger';

const SIZE_CLASS: Record<BtnSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

/* ---------------- Button ---------------- */
export function Button({
  variant = 'default',
  size = 'md',
  icon = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  /** 纯图标按钮：正方形，视觉更克制 */
  icon?: boolean;
}) {
  return (
    <button
      className={cn(
        'btn hit',
        SIZE_CLASS[size],
        icon && 'btn-icon',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- IconButton ----------------
   带无障碍标签的图标按钮，列表/工具栏里统一用它 */
export function IconButton({
  label,
  size = 'sm',
  variant = 'ghost',
  children,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  size?: BtnSize;
  variant?: BtnVariant;
  children: ReactNode;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      icon
      aria-label={label}
      title={label}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  right,
  icon,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14px] font-semibold leading-6">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        {sub ? (
          <div className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</div>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  className,
  style,
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  title?: string;
}) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--sd-r-xs)] px-2 py-[3px]',
        'text-[12px] font-semibold leading-5',
        onClick && 'hit cursor-pointer transition-colors hover:brightness-110',
        className,
      )}
      style={style}
    >
      {children}
    </Comp>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="hit flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[var(--sd-r-sm)] py-1 text-left"
    >
      {label ? (
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-fg">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-faint">{hint}</span>
          ) : null}
        </span>
      ) : null}
      <span
        className={cn(
          'relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line2',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all',
            checked ? 'left-[21px]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  );
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-[var(--sd-r-md)] border border-line bg-raise p-[2px]',
        size === 'sm' ? 'h-[32px]' : 'h-[40px]',
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative h-full rounded-[var(--sd-r-sm)] font-medium transition-colors',
            size === 'sm' ? 'px-2.5 text-[13px]' : 'px-3.5 text-[13px]',
            value === o.value
              ? 'bg-brand text-white shadow-sm'
              : 'text-muted hover:bg-[color-mix(in_srgb,var(--sd-line2)_45%,transparent)] hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="animate-in relative z-10 my-4 w-full border border-line bg-panel"
        style={{ maxWidth: width, borderRadius: 'var(--sd-r-modal)', boxShadow: 'var(--sd-sh-3)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <IconButton label="关闭" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Empty ----------------
   空态：柔和图标底 + 标题 + 说明 + 明确的下一步动作 */
export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--sd-r-card)] border"
          style={{
            background:
              'linear-gradient(140deg, color-mix(in srgb, var(--sd-brand) 16%, transparent), transparent 70%)',
            borderColor: 'color-mix(in srgb, var(--sd-brand) 22%, transparent)',
            color: 'var(--sd-brand)',
          }}
        >
          {icon}
        </div>
      ) : null}
      <div className="text-[14px] font-semibold">{title}</div>
      {hint ? (
        <div className="mt-1.5 max-w-[22rem] text-[13px] leading-relaxed text-faint">{hint}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------------- Skeleton ----------------
   骨架屏：载入时先给出布局轮廓，避免"空白一闪" */
export function Skeleton({
  w,
  h,
  r = 'var(--sd-r-sm)',
  className,
}: {
  w?: number | string;
  h?: number | string;
  r?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('sk', className)}
      style={{ width: w, height: h, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} h={12} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </div>
  );
}

/* ---------------- Stat ---------------- */
export function Stat({
  label,
  value,
  delta,
  sub,
  icon,
  accent,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: number;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  const color = accent ?? 'var(--sd-brand)';
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon ? (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[var(--sd-r-sm)]"
            style={{
              background: `color-mix(in srgb, ${color} 15%, transparent)`,
              color,
            }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tnum mt-2.5 text-[24px] font-semibold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        {delta !== undefined ? (
          <span className={cn('font-semibold', delta >= 0 ? 'text-ok' : 'text-danger')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {sub ? <span className="text-faint">{sub}</span> : null}
      </div>
    </div>
  );
}

/* ---------------- Progress ---------------- */
export function Progress({
  value,
  max,
  color = 'var(--sd-brand)',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line2">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* ---------------- Section label ---------------- */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="label">{children}</span>
      {right}
    </div>
  );
}
