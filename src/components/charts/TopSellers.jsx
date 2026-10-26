import { Card, CardHeader } from '../ui/Card.jsx';
import { TrendingUp } from '../icons.js';
import { money, num } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const SEGMENTS = 10;
const COLORS = ['var(--brand-2)', '#d17b2e', '#7aa22d', 'var(--c-profit)'];

/** Segmented column: filled from the bottom, scaled so the best seller is always full. */
function SegmentBar({ filled, color }) {
  return (
    <div className="flex flex-col gap-[5px]" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className="h-[10px] rounded-full transition-colors duration-300"
          style={{ background: i >= SEGMENTS - filled ? color : `color-mix(in srgb, ${color} 14%, transparent)` }}
        />
      ))}
    </div>
  );
}

/** Top selling drinks over the last 30 days: share of sales per drink as segmented columns. */
export function TopSellers({ data, className }) {
  const { items, revenue = 0, margin = 0, others = { count: 0, share: 0 } } = data;
  const max = Math.max(...items.map((i) => i.share), 0);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader title="Top Selling Drinks" action={<span className="text-[13.5px] font-semibold text-brand-ink">Last 30 days</span>} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <b className="tnum text-[28px] leading-none font-bold tracking-[-0.03em] sm:text-[34px]">{money(revenue)}</b>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink">
          <TrendingUp size={13} />
          {Math.round(margin)}% margin
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-ink-3">No sales in the last 30 days yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-y-6 sm:grid-cols-4 xl:gap-y-0">
          {items.map((item, i) => {
            const filled = item.share > 0 ? Math.max(1, Math.round((item.share / max) * SEGMENTS)) : 0;
            return (
              <div key={item.variantId} className={cn('min-w-0 px-3 first:pl-0 last:pr-0 sm:border-l sm:border-dashed sm:border-line sm:first:border-l-0', i % 2 === 0 && 'max-sm:pl-0', i % 2 === 1 && 'max-sm:border-l max-sm:border-dashed max-sm:border-line')}>
                <div className="truncate text-[13.5px] text-ink-2" title={item.name}>
                  {item.name}
                </div>
                <div className="tnum mt-2.5 mb-4 text-[22px] font-semibold tracking-[-0.02em]">{item.share.toFixed(1)}%</div>
                <SegmentBar filled={filled} color={COLORS[i % COLORS.length]} />
                <div className="tnum mt-3 text-[12px] text-ink-3">
                  {num(item.unitsSold)} sold
                </div>
              </div>
            );
          })}
        </div>
      )}

      {others.count > 0 && (
        <p className="mt-5 text-[13px] text-ink-3">
          Other: {others.count} more {others.count === 1 ? 'drink' : 'drinks'} · {others.share.toFixed(1)}% of sales
        </p>
      )}
    </Card>
  );
}
