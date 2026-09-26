import { Link } from 'react-router-dom';
import { Activity, Bottle, Package, Receipt, Truck, Users, Wallet, Settings } from './icons.js';
import { cn } from '../utils/cn.js';
import { pct, timeAgo } from '../utils/format.js';

const CATEGORY_COLORS = ['#0EA271', '#D97706', '#6366F1', '#F97316', '#0EA5E9', '#65A30D'];

/** Column bars from the reference design: one column per category, 10 segments each. */
export function CategoryBars({ categories }) {
  const top = categories.slice(0, 4);
  const max = top[0]?.revenue || 1;
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-4">
      {top.map((c, i) => {
        const filled = Math.max(1, Math.round((c.revenue / max) * 10));
        const color = CATEGORY_COLORS[i];
        return (
          <div key={c.category} className={cn('flex min-w-0 flex-col gap-1.5 border-dashed border-line pl-2.5', i % 2 === 1 && 'border-l', i >= 2 && 'sm:border-l', i === 0 && 'pl-0', i === 2 && 'pl-0 sm:pl-2.5')}>
            <small className="truncate text-[12.5px] text-ink-2">{c.category}</small>
            <b className="tnum mb-1.5 text-[18px] font-semibold">{pct(c.share)}</b>
            {Array.from({ length: 10 }, (_, s) => (
              <i key={s} className="block h-[9px] rounded-full" style={{ background: 10 - s <= filled ? color : `color-mix(in srgb, ${color} 14%, var(--surface))` }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** One tick per size, coloured by stock health. */
export function StockTicks({ items }) {
  const tone = { in: 'bg-ok', low: 'bg-warn', out: 'bg-bad' };
  return (
    <div className="flex h-[38px] gap-[3px]" aria-hidden="true">
      {items.map((i) => (
        <i key={i.variantId} title={i.name} className={cn('flex-1 rounded-[3px] opacity-85', tone[i.status])} />
      ))}
    </div>
  );
}

export function Meter({ value, max, tone = 'brand', className }) {
  const w = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const bar = { brand: 'bg-brand', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}>
      <i className={cn('block h-full rounded-full', bar)} style={{ width: `${w}%` }} />
    </div>
  );
}

const KIND = {
  sale: [Receipt, 'bg-info-soft text-info'],
  inventory: [Package, 'bg-warn-soft text-warn'],
  product: [Bottle, 'bg-brand-soft text-brand'],
  staff: [Users, 'bg-surface-3 text-ink-2'],
  supplier: [Truck, 'bg-surface-3 text-ink-2'],
  credit: [Wallet, 'bg-ok-soft text-ok'],
  settings: [Settings, 'bg-surface-3 text-ink-2'],
  auth: [Activity, 'bg-surface-3 text-ink-2'],
};
export const activityIcon = (category) => KIND[category] || KIND.auth;

export function activityLink(a) {
  if (a.entityType === 'Sale' && a.entityId) return `/admin/sales/${a.entityId}`;
  if (a.entityType === 'Product' && a.entityId) return `/admin/products/${a.entityId}`;
  if (a.entityType === 'Supplier' && a.entityId) return `/admin/suppliers/${a.entityId}`;
  if (a.entityType === 'Customer' && a.entityId) return `/admin/customers/${a.entityId}`;
  if (a.entityType === 'User' && a.entityId) return `/admin/staff/${a.entityId}`;
  return null;
}

/** Compact timeline used on the dashboard. */
export function ActivityTimeline({ items }) {
  const dot = { sale: 'bg-info-soft text-info', inventory: 'bg-warn-soft text-warn', product: 'bg-brand-soft text-brand', credit: 'bg-ok-soft text-ok' };
  return (
    <ol className="flex flex-col">
      {items.map((a, i) => {
        const to = activityLink(a);
        const text = (
          <p className="text-[14px]">
            <b className="font-semibold">{a.user?.name.split(' ')[0]}</b> {a.summary} {a.target && <b className="font-semibold">{a.target}</b>}
          </p>
        );
        return (
          <li key={a.id} className="relative flex gap-3 py-2.5">
            {i < items.length - 1 && <span className="absolute top-7 -bottom-1.5 left-[7px] w-[1.5px] bg-line-2" />}
            <span className={cn('mt-0.5 grid size-4 flex-none place-items-center rounded-full', dot[a.category] || 'bg-surface-3 text-ink-3')}>
              <span className="size-2 rounded-full bg-current" />
            </span>
            <div className="min-w-0 flex-1">
              {to ? <Link to={to} className="hover:underline">{text}</Link> : text}
              <small className="text-[12.5px] text-ink-3">
                {a.detail ? `${a.detail} · ` : ''}
                {timeAgo(a.createdAt)}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
