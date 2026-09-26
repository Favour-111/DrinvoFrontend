import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

export function EmptyState({ icon: Icon, title, text, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-5 py-11 text-center', className)}>
      <div className="mb-3.5 grid size-[64px] place-items-center rounded-full bg-brand-soft text-brand">{Icon && <Icon size={26} />}</div>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {text && <p className="mb-2 max-w-[340px] text-[13.5px] text-ink-3">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-5 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle size={22} />
      </span>
      <h3 className="text-[16px] font-semibold">This page couldn’t load</h3>
      <p className="max-w-sm text-[13.5px] text-ink-3">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button className="mt-2" onClick={onRetry}>
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
