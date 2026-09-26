import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Calendar, MoreHorizontal, Plus, ShoppingCart } from '../../components/icons.js';
import { Page } from '../../components/ui/Nav.jsx';
import { CardLink } from '../../components/ui/Card.jsx';
import { PageSkeleton } from '../../components/ui/Feedback.jsx';
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

/** "↑2% from yesterday" — omitted when there's nothing to compare against yet. */
function Trend({ current, previous }) {
  if (!previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-ok' : 'text-bad')}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 120 44" className="h-11 w-[110px] flex-none" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="staffHomeSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--ok)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 30 C18 34 30 14 46 20 S74 34 92 16 S112 8 120 6 V44 H0 Z" fill="url(#staffHomeSpark)" />
      <path d="M0 30 C18 34 30 14 46 20 S74 34 92 16 S112 8 120 6" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="120" cy="6" r="3.5" fill="var(--ok)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

function MiniBars() {
  const heights = [12, 18, 15, 22, 32, 17, 20];
  return (
    <svg viewBox="0 0 98 40" className="h-10 w-[92px] flex-none" aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={i * 14} y={40 - h} width="8" height={h} rx="3" fill="var(--warn)" opacity={i === 4 ? 1 : 0.3} />
      ))}
    </svg>
  );
}

function Blobs() {
  return (
    <span className="relative z-10 hidden h-24 w-40 flex-none items-center justify-center sm:flex" aria-hidden="true">
      <span className="absolute size-24 rounded-[62%_38%_55%_45%/45%_60%_40%_55%] bg-white/15 blur-[2px]" />
      <span className="absolute -translate-x-6 translate-y-3 size-16 rounded-[45%_55%_60%_40%/55%_45%_60%_40%] bg-white/20" />
      <span className="absolute translate-x-7 -translate-y-4 size-12 rounded-[55%_45%_40%_60%/40%_55%_45%_60%] bg-white/25" />
    </span>
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

  useStockUpdates((rows) => {
    setItems((prev) => (prev ? mergeStockRows(prev, rows) : prev));
    if (shop?.id) patchLocalProducts(shop.id, rows);
  });

  if (loading) return <PageSkeleton stats={2} chart={false} />;
  const available = (items || []).filter((p) => p.status !== 'out').slice(0, 12);

  const add = (p) => {
    cart.add(p);
    navigate('/staff/sale');
  };

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.09em] text-ink-3 uppercase">{shop?.name}</p>
          <h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.01em]">
            {greeting()}, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Here’s what’s happening in your shop today.</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-full bg-ok-soft py-1.5 pr-4 pl-1.5 text-[13px] font-semibold text-ink">
          <span className="grid size-7 flex-none place-items-center rounded-full bg-surface text-ok shadow-sm">
            <Calendar size={14} />
          </span>
          {todayLong()}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="card flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-brand text-on-brand">
                <BarChart3 size={18} />
              </span>
              <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[10px] bg-surface-2 text-ink-3">
                <MoreHorizontal size={16} />
              </span>
            </div>
            <div className="text-[13.5px] font-medium text-ink-2">Today’s Sales</div>
            <div className="tnum mt-1 truncate text-[24px] font-bold tracking-[-0.03em] sm:text-[26px]">{money(me.todaySales)}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
              <Trend current={me.todaySales} previous={me.yesterdaySales} />
              <span className="text-ink-3">{me.yesterdaySales ? 'from yesterday' : 'your sales only'}</span>
            </div>
          </div>
          <Sparkline />
        </div>

        <div className="card flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-warn-soft text-warn">
                <ShoppingCart size={18} />
              </span>
              <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[10px] bg-surface-2 text-ink-3">
                <MoreHorizontal size={16} />
              </span>
            </div>
            <div className="text-[13.5px] font-medium text-ink-2">Today’s Transactions</div>
            <div className="tnum mt-1 truncate text-[24px] font-bold tracking-[-0.03em] sm:text-[26px]">{me.todayTransactions ?? 0}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
              <Trend current={me.todayTransactions} previous={me.yesterdayTransactions} />
              <span className="text-ink-3">{me.yesterdayTransactions ? 'from yesterday' : me.todayTransactions ? `average ${money(me.todayAverage)}` : 'none yet'}</span>
            </div>
          </div>
          <MiniBars />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/staff/sale')}
        className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[16px] bg-brand px-[22px] py-5 text-left text-white transition-colors hover:bg-brand-2 active:scale-[0.99]"
      >
        <span className="relative z-10 flex items-center gap-4">
          <span className="grid size-[52px] flex-none place-items-center rounded-[14px] bg-white/15">
            <Plus size={28} />
          </span>
          <span>
            <b className="block text-[19px]">New Sale</b>
            <small className="text-[13px] opacity-80">Search, add drinks, pick payment, done.</small>
          </span>
        </span>
        <Blobs />
        <span className="relative z-10 grid size-11 flex-none place-items-center rounded-full bg-white text-brand shadow-sm">
          <ArrowRight size={20} />
        </span>
      </button>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Available products</h2>
          <CardLink to="/staff/sale">See all</CardLink>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
          {available.map((p) => (
            <ProductCard key={p.variantId} product={p} onAdd={add} inCart={cart.lines.filter((l) => l.product.variantId === p.variantId).reduce((s, l) => s + l.quantity, 0)} />
          ))}
        </div>
      </div>
    </Page>
  );
}
