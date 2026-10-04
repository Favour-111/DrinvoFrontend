import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { Sparkline } from './Sparkline.jsx';

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

/**
 * Metric card: gradient icon tile, label, big value, optional trend footer and an
 * optional sparkline across the bottom-right. Each item in a StatBar is its own card.
 */
export function StatBar({ items, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', COLS[items.length] || COLS[5], className)}>
      {items.map(({ key, label, value, icon: Icon, footer, to, iconTone = 'brand', spark, sparkColor }) => {
        const content = (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className={cn('tile', `tile-${iconTone}`)}>{Icon && <Icon size={18} strokeWidth={2} />}</span>
              {to ? (
                <span className="grid size-7 flex-none place-items-center rounded-full border border-line text-ink-3 transition-colors group-hover:border-brand/40 group-hover:text-brand-ink">
                  <ArrowUpRight size={14} />
                </span>
              ) : null}
            </div>
            <div className="mt-3.5 text-[13px] font-medium text-ink-2">{label}</div>
            <div className="tnum mt-1 truncate text-[22px] font-bold tracking-[-0.03em] sm:text-[24px]">{value}</div>
            {spark && spark.length > 1 && <Sparkline values={spark} color={sparkColor || TILE_COLOR[iconTone]} width={120} height={34} fluid className="mt-3 block" />}
            {footer && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-ink-3">{footer}</div>}
          </>
        );
        const cls = cn('card group flex min-w-0 flex-col p-4 text-left sm:p-[18px]', to && 'card-lift cursor-pointer');
        return to ? (
          <Link key={key} to={to} className={cls}>
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

const COLS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

const TILE_COLOR = { brand: 'var(--brand-2)', ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', profit: 'var(--c-profit)', neutral: 'var(--ink-2)' };

/**
 * Single headline number card: icon tile, label, big value and a trend footer.
 * `dark` fills the icon solid brand for one emphasised card in a row.
 */
export function StatCard({ label, value, icon: Icon, footer, to, dark, iconTone = 'brand' }) {
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className={cn('tile', dark ? 'tile-brand' : `tile-${iconTone}`)}>{Icon && <Icon size={18} />}</span>
        {to && (
          <span className="grid size-7 place-items-center rounded-full border border-line text-ink-3 transition-colors group-hover:border-brand/40 group-hover:text-brand-ink">
            <ArrowUpRight size={14} />
          </span>
        )}
      </div>
      <div className="text-[13px] font-medium text-ink-2">{label}</div>
      <div className="tnum mt-1 truncate text-[22px] font-bold tracking-[-0.03em] sm:text-[24px]">{value}</div>
      {footer && <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">{footer}</div>}
    </>
  );
  const cls = cn('card group flex min-w-0 flex-col p-4 text-left sm:p-[18px]', to && 'card-lift cursor-pointer');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
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
