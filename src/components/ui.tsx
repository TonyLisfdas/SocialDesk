import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/* ---------------- Button ---------------- */
type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger';

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'border-[color-mix(in_srgb,#ef4444_45%,transparent)] text-[#ef4444] hover:bg-[color-mix(in_srgb,#ef4444_12%,transparent)]',
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'h-10 px-5 rounded-[10px]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, sub, right, icon }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        {sub ? <div className="mt-1 text-[12px] text-muted leading-relaxed">{sub}</div> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ children, className, style, onClick, title }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void; title?: string }) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      title={title}
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-5', className)}
      style={style}
    >
      {children}
    </Comp>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      {label ? (
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-fg">{label}</span>
          {hint ? <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">{hint}</span> : null}
        </span>
      ) : null}
      <span
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line2',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-[19px]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  );
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-raise p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[7px] font-medium transition-colors',
            size === 'sm' ? 'h-[26px] px-2.5 text-[12px]' : 'h-[30px] px-3 text-[12.5px]',
            value === o.value ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, width = 560, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
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
        className="animate-in relative z-10 my-4 w-full rounded-2xl border border-line bg-panel shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted transition-colors hover:bg-raise hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------------- Empty ---------------- */
export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-muted opacity-60">{icon}</div> : null}
      <div className="text-[13.5px] font-medium">{title}</div>
      {hint ? <div className="max-w-sm text-[12px] leading-relaxed text-faint">{hint}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* ---------------- Stat ---------------- */
export function Stat({ label, value, delta, sub, icon, accent }: { label: ReactNode; value: ReactNode; delta?: number; sub?: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {icon ? (
          <span className="rounded-lg p-1.5" style={{ background: `color-mix(in srgb, ${accent ?? 'var(--sd-brand)'} 16%, transparent)`, color: accent ?? 'var(--sd-brand)' }}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[24px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-[11.5px]">
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
export function Progress({ value, max, color = 'var(--sd-brand)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line2">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
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
