import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export function Card({ as: As = 'section', className, flush, children, ...props }) {
  return (
    <As className={cn('card', flush ? 'overflow-hidden' : 'p-5', className)} {...props}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, className, flush }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3', flush && 'px-5 pt-[18px] mb-3.5', className)}>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {action}
    </div>
  );
}

export function CardLink({ to, children }) {
  return (
    <Link to={to} className="text-[13px] font-semibold text-brand hover:underline">
      {children}
    </Link>
  );
}

const ICON_TONE = {
  brand: 'bg-brand-soft text-brand',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-surface-3 text-ink-2',
};

/**
 * Headline number card: icon, label, a big prominent value and a small
 * trend pill. `dark` only changes the icon to a solid brand fill — every
 * stat card otherwise reads the same, so the row stays calm and uniform.
 */
export function StatCard({ label, value, icon: Icon, footer, to, dark, iconTone = 'brand' }) {
  const body = (
    <>
      <div className="mb-2.5 flex items-center justify-between">
        <span className={cn('grid size-[34px] place-items-center rounded-[10px]', dark ? 'bg-brand text-on-brand' : ICON_TONE[iconTone])}>{Icon && <Icon size={17} />}</span>
        {to && (
          <span className="grid size-8 place-items-center rounded-full border border-line text-ink-3 transition-colors group-hover:border-ink-3/40 group-hover:text-ink-2">
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
      <div className="text-[13.5px] font-medium text-ink-2">{label}</div>
      <div className="tnum mt-1 truncate text-[22px] font-bold tracking-[-0.03em] sm:text-[26px]">{value}</div>
      {footer && <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">{footer}</div>}
    </>
  );
  const cls = cn('card group flex min-w-0 flex-col p-3.5 text-left sm:p-[18px]', to && 'transition-shadow hover:shadow-pop');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * One bordered bar holding several stats side by side, divided by hairlines
 * instead of separate shadowed cards — calmer than a row of individual tiles.
 */
export function StatBar({ items }) {
  return (
    <div className="card grid grid-cols-2 divide-y divide-line-2 p-0 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      {items.map(({ key, label, value, icon: Icon, footer, to, iconTone = 'brand' }) => {
        const content = (
          <>
            <div className="mb-2.5 flex items-center justify-between">
              <span className={cn('grid size-[34px] place-items-center rounded-[10px]', ICON_TONE[iconTone])}>{Icon && <Icon size={17} />}</span>
              {to && <ArrowUpRight size={15} className="text-ink-3 transition-colors group-hover:text-ink-2" />}
            </div>
            <div className="text-[13.5px] font-medium text-ink-2">{label}</div>
            <div className="tnum mt-1 truncate text-[22px] font-bold tracking-[-0.03em] sm:text-[26px]">{value}</div>
            {footer && <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">{footer}</div>}
          </>
        );
        const cls = 'group flex min-w-0 flex-col p-4 sm:p-5';
        return to ? (
          <Link key={key} to={to} className={cn(cls, 'transition-colors hover:bg-surface-2')}>
            {content}
          </Link>
        ) : (
          <div key={key} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function MiniStat({ label, value, tone }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className={cn('tnum mt-1 text-[20px] font-bold tracking-[-0.02em]', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>{value}</div>
    </div>
  );
}

export function DetailList({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[13.5px]">
      {rows.filter(Boolean).map(([k, v, strong]) => (
        <div key={k} className="contents">
          <dt className={cn(strong ? 'font-semibold text-ink' : 'text-ink-3')}>{k}</dt>
          <dd className={cn('tnum text-right font-medium', strong && 'text-[17px] font-bold')}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
