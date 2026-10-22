import { MiniatureTag } from './ui/Badge.jsx';
import { money, num, plural } from '../utils/format.js';

/**
 * Miniature drinks at a glance. These figures are a subset of the overall totals shown elsewhere
 * (never added on top), so the card says so. Renders nothing when there are no miniature products.
 */
export function MiniatureStockSummary({ stock, today }) {
  if (!stock?.variantCount) return null;
  const cells = [
    ['Bottles in stock', num(stock.totalBottles)],
    ['Equivalent', [stock.cartons && plural(stock.cartons, 'carton'), stock.packs && plural(stock.packs, 'pack'), stock.looseBottles && plural(stock.looseBottles, 'bottle')].filter(Boolean).join(' · ') || '—'],
    ['Low / out of stock', `${stock.lowStock} / ${stock.outOfStock}`],
    ...(today ? [['Sold today', plural(today.bottlesSold, 'bottle')], ['Revenue today', money(today.revenue)]] : []),
  ];
  return (
    <section aria-label="Miniature drinks" className="rounded-[18px] border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MiniatureTag />
        <b className="text-[14.5px] font-semibold">Miniature drinks</b>
        <small className="text-[12px] text-ink-3">
          {plural(stock.variantCount, 'size')} · included in the totals above
        </small>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[12px] text-ink-3">{label}</dt>
            <dd className="tnum truncate text-[15px] font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
