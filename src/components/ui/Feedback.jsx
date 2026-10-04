import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

/** Friendly empty state: a soft gradient medallion with decorative blobs, a clear title and an optional next step. */
export function EmptyState({ icon: Icon, title, text, action, className }) {
  return (
    <div className={cn('relative flex flex-col items-center gap-2 overflow-hidden px-5 py-12 text-center', className)}>
      <span className="blob -top-10 -left-6 size-28 opacity-70" aria-hidden="true" />
      <span className="blob -right-8 bottom-0 size-24 opacity-50" aria-hidden="true" />
      <div className="relative mb-3 grid size-[68px] place-items-center rounded-[22px] bg-linear-to-br from-brand-soft to-surface-2 text-brand shadow-[inset_0_0_0_1px_var(--line),0_10px_24px_-14px_var(--brand-2)]">
        {Icon && <Icon size={28} strokeWidth={1.8} />}
      </div>
      <h3 className="relative text-[16px] font-semibold">{title}</h3>
      {text && <p className="relative mb-2 max-w-[360px] text-[13.5px] leading-relaxed text-ink-3">{text}</p>}
      {action && <div className="relative mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card relative flex flex-col items-center gap-2 overflow-hidden px-5 py-12 text-center">
      <span className="blob -top-10 -right-6 size-28 bg-bad opacity-[0.08]" aria-hidden="true" />
      <span className="tile tile-bad relative mb-2 size-14 rounded-[18px]">
        <AlertTriangle size={24} />
      </span>
      <h3 className="relative text-[16px] font-semibold">This page couldn’t load</h3>
      <p className="relative max-w-sm text-[13.5px] text-ink-3">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button className="relative mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className, style }) {
  return <div className={cn('sk', className)} style={style} aria-hidden="true" />;
}

/** Generic page skeleton: header, stat cards, a chart block and table rows. */
export function PageSkeleton({ stats = 4, chart = true, rows = 6 }) {
  return (
    <div className="flex flex-col gap-4 pt-1.5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      {stats > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="card p-5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="mt-4 h-7 w-3/4" />
              <Skeleton className="mt-3.5 h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}
      {chart && (
        <div className="card p-5">
          <Skeleton className="h-60" />
        </div>
      )}
      <div className="card p-5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="my-3.5 h-[18px]" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="p-5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="my-3 h-[18px]" />
      ))}
    </div>
  );
}
