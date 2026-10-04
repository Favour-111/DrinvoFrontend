import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Calendar, Clock, MessageCircle, Package, Plus, Receipt, Search, ShoppingCart } from '../../components/icons.js';
import { Chips, Page } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { EmptyState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductCard } from '../../components/ProductCard.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLocalProducts } from '../../hooks/useLocalProducts.js';
import { useStockUpdates } from '../../hooks/useStockUpdates.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { patchLocalProducts } from '../../offline/catalogSync.js';
import { reportService } from '../../services/index.js';
import { greeting, money, todayLong } from '../../utils/format.js';
import { mergeStockRows } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const CATEGORY_DOT = ['bg-brand-2', 'bg-info', 'bg-warn', 'bg-profit', 'bg-bad', 'bg-ink-3'];

/** Soft wave backdrop behind the greeting, drawn in brand tints. */
function Waves() {
  return (
    <svg viewBox="0 0 1200 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-[260px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id="staffWave" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--brand-3)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path d="M0 150 C220 90 380 210 620 150 S1000 70 1200 120 L1200 240 L0 240 Z" fill="url(#staffWave)" />
      <path d="M0 190 C260 150 460 230 720 190 S1040 140 1200 176 L1200 240 L0 240 Z" fill="var(--brand-2)" opacity="0.07" />
    </svg>
  );
}

function ClockChip() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.04)]">
      <Clock size={15} className="text-brand" />
      {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
    </span>
  );
}

/** Action card: the two big entry points. `variant` picks the solid brand card or the soft mint one. */
function ActionCard({ to, variant, icon: Icon, title, text, watermark: Watermark }) {
  const navigate = useNavigate();
  const solid = variant === 'solid';
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        'group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[22px] px-5 py-5 text-left transition-all duration-200 active:scale-[0.99] sm:px-6',
        solid
          ? 'bg-linear-to-br from-brand-2 via-brand to-[#06563f] text-white shadow-[0_18px_36px_-18px_rgba(4,120,87,0.7)] hover:shadow-[0_22px_40px_-16px_rgba(4,120,87,0.75)]'
          : 'border border-brand/15 bg-linear-to-br from-brand-soft via-surface to-brand-soft/60 text-ink shadow-[0_12px_30px_-22px_rgba(4,120,87,0.4)] hover:shadow-[0_16px_34px_-20px_rgba(4,120,87,0.5)]'
      )}
    >
      <span className="relative z-10 flex items-center gap-4">
        <span className={cn('grid size-14 flex-none place-items-center rounded-[17px] shadow-inner', solid ? 'bg-white/15' : 'bg-linear-to-br from-brand-2 to-brand text-white shadow-[0_10px_20px_-10px_rgba(16,185,129,0.9)]')}>
          <Icon size={solid ? 28 : 26} strokeWidth={2} />
        </span>
        <span>
          <b className="block text-[19px] font-bold tracking-[-0.01em]">{title}</b>
          <small className={cn('mt-0.5 block text-[13.5px]', solid ? 'text-white/80' : 'text-ink-2')}>{text}</small>
        </span>
      </span>
      {Watermark && <Watermark className={cn('pointer-events-none absolute -right-3 -bottom-4 size-40 transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3', solid ? 'text-white/10' : 'text-brand/10')} />}
      <span
        className={cn(
          'relative z-10 grid size-11 flex-none place-items-center rounded-full shadow-sm transition-transform duration-200 group-hover:translate-x-0.5',
          solid ? 'bg-white text-brand' : 'bg-brand text-white'
        )}
      >
        <ArrowRight size={20} />
      </span>
    </button>
  );
}

/** Watermark: a large shopping-cart outline, drawn with strokes so it works at any size. */
function CartWatermark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.7 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6.2" />
    </svg>
  );
}

function ChatWatermark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11.5a8.5 8.5 0 0 1 12.8-7.3A8.5 8.5 0 0 1 21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.5-4.6A8.5 8.5 0 0 1 3 11.5z" />
    </svg>
  );
}

export default function StaffHome() {
  const { user, shop } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  // Stats need the network; the product grid below doesn't — it's local-first and renders
  // instantly from IndexedDB even if this call is slow, failing or offline entirely.
  const { data: meData } = useApi(() => reportService.me(), []);
  const me = meData || {};
  const { items, loading, setItems } = useLocalProducts(shop?.id);
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');

  useStockUpdates((rows) => {
    setItems((prev) => (prev ? mergeStockRows(prev, rows) : prev));
    if (shop?.id) patchLocalProducts(shop.id, rows);
  });

  const categories = useMemo(() => {
    const counts = new Map();
    for (const p of items || []) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const available = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items || []).filter((p) => p.status !== 'out' && (category === 'All' || p.category === category) && (!needle || `${p.name} ${p.brand} ${p.size}`.toLowerCase().includes(needle)));
  }, [items, category, q]);

  if (loading) return <PageSkeleton stats={2} chart={false} />;

  const add = (p) => {
    cart.add(p);
    navigate('/staff/sale');
  };

  const activeCount = (items || []).filter((p) => p.status !== 'out').length;
  const lowCount = (items || []).filter((p) => p.status === 'low').length;
  const outCount = (items || []).filter((p) => p.status === 'out').length;
  const totalCount = (items || []).length;

  return (
    <Page className="relative">
      <Waves />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.14em] text-brand-ink uppercase">{shop?.name}</p>
          <h1 className="mt-1.5 text-[28px] font-extrabold tracking-[-0.025em] sm:text-[34px]">
            {greeting()}, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-3">Here’s what’s happening in your shop today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.04)]">
            <Calendar size={15} className="text-brand" />
            {todayLong()}
          </span>
          <ClockChip />
        </div>
      </div>

      <StatBar
        items={[
          { key: 'sales', label: 'Today’s sales', value: money(me.todaySales), icon: Receipt, iconTone: 'brand', to: '/staff/sales', footer: me.yesterdaySales ? <TrendFooter current={me.todaySales} previous={me.yesterdaySales} /> : 'your sales only' },
          { key: 'tx', label: 'Transactions', value: me.todayTransactions ?? 0, icon: ShoppingCart, iconTone: 'warn', to: '/staff/sales', footer: me.todayTransactions ? `average ${money(me.todayAverage)}` : 'none yet' },
          { key: 'products', label: 'Products', value: activeCount, icon: Package, iconTone: 'info', to: '/staff/inventory', footer: `${totalCount} in the catalogue` },
          { key: 'low', label: 'Need restocking', value: lowCount + outCount, icon: AlertTriangle, iconTone: lowCount + outCount ? 'bad' : 'ok', to: '/staff/inventory', footer: outCount ? `${outCount} out of stock` : 'stock levels look good' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard to="/staff/sale" variant="solid" icon={Plus} title="New Sale" text="Search drinks, add to cart, pick payment, done." watermark={CartWatermark} />
        <ActionCard to="/staff/share-prices" variant="soft" icon={MessageCircle} title="Share Prices" text="Send carton and bottle prices on WhatsApp." watermark={ChatWatermark} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.015em]">Available products</h2>
            <p className="mt-0.5 text-[13.5px] text-ink-3">Quickly find and add products to your sale.</p>
          </div>
          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-[300px] sm:flex-none">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks, e.g. Coca, Sprite…" aria-label="Search products" className="input h-11 rounded-[14px] pl-10" />
            </label>
            <button type="button" onClick={() => navigate('/staff/sale')} className="hidden h-11 items-center gap-1.5 rounded-[14px] border border-line bg-surface px-4 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.04)] transition-colors hover:bg-surface-2 sm:inline-flex">
              See all
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="mb-4 lg:hidden">
          <Chips label="Category" options={[['All', `All (${totalCount})`], ...categories.map(([c, n]) => [c, `${c} (${n})`])]} value={category} onChange={setCategory} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <Card className="hidden h-fit p-3 lg:block">
            <div className="flex flex-col gap-1">
              {[['All', 'All products', totalCount], ...categories.map(([c, n]) => [c, c, n])].map(([key, label, n], i) => {
                const on = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-[13px] px-3 text-left text-[13.5px] font-medium transition-colors',
                      on ? 'bg-linear-to-r from-brand-2 to-brand font-semibold text-white shadow-[0_8px_18px_-10px_rgba(4,120,87,0.8)]' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                    )}
                  >
                    {key === 'All' ? <span className={cn('size-2 rounded-full', on ? 'bg-white' : 'bg-brand-2')} /> : <span className={cn('size-2 rounded-full', CATEGORY_DOT[(i - 1) % CATEGORY_DOT.length])} />}
                    <span className="flex-1 truncate">{label}</span>
                    <span className={cn('tnum rounded-full px-2 py-0.5 text-[11.5px] font-semibold', on ? 'bg-white/20' : 'bg-surface-3 text-ink-3')}>{n}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div>
            {available.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {available.slice(0, 12).map((p) => (
                  <ProductCard key={p.variantId} product={p} onAdd={add} inCart={cart.lines.filter((l) => l.product.variantId === p.variantId).reduce((s, l) => s + l.quantity, 0)} />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={ShoppingCart}
                  title={q || category !== 'All' ? 'Nothing matches that' : 'No products available yet'}
                  text={q || category !== 'All' ? 'Try another search or category.' : 'Products your admin adds show up here, ready to sell.'}
                  action={q || category !== 'All' ? <button type="button" onClick={() => { setQ(''); setCategory('All'); }} className="text-[13.5px] font-semibold text-brand-ink hover:underline">Clear filters</button> : null}
                />
              </Card>
            )}
          </div>
        </div>
      </section>
    </Page>
  );
}

/** "↑ 12% vs yesterday" in the same style as the admin dashboard. */
function TrendFooter({ current, previous }) {
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold', up ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
        {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      </span>
      vs yesterday
    </span>
  );
}
