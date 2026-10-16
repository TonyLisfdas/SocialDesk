import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={cn(
            'animate-in pointer-events-auto flex cursor-pointer items-center gap-2 rounded-[var(--sd-r-md)] border px-3.5 py-2 text-[13px] font-medium shadow-xl',
            t.tone === 'ok' && 'border-line2 bg-raise text-fg',
            t.tone === 'warn' && 'border-[color-mix(in_srgb,#f59e0b_45%,transparent)] bg-[color-mix(in_srgb,#f59e0b_14%,var(--sd-raise))] text-[#fbbf24]',
            t.tone === 'error' && 'border-[color-mix(in_srgb,#ef4444_45%,transparent)] bg-[color-mix(in_srgb,#ef4444_14%,var(--sd-raise))] text-[#f87171]',
          )}
        >
          {t.tone === 'ok' ? <CheckCircle2 size={15} /> : t.tone === 'warn' ? <AlertTriangle size={15} /> : <XCircle size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
