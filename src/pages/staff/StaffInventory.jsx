import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Ban, ClipboardList, LayoutGrid, MessageCircle, Package, PackageSearch, Search, SlidersHorizontal, Undo2 } from '../../components/icons.js';
import { Page } from '../../components/ui/Nav.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { StockBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { TransferModal } from '../../components/modals/StockModals.jsx';
import { BorrowModal } from '../../components/modals/BorrowModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { inventoryService } from '../../services/index.js';
import { money, num, plural } from '../../utils/format.js';
import { describeStock, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  stock: (a, b) => b.quantity - a.quantity,
  price: (a, b) => b.sellingPrice - a.sellingPrice,
};

/** Stock view for staff: read-only for levels (the API strips cost fields for this role), but
 * staff can record a transfer to move stock between shops and lend or borrow drinks. */
export default function StaffInventory() {
  const { shops } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [view, setView] = useState('list');
  const [transferring, setTransferring] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const { data, error, reload } = useApi(() => inventoryService.list(), []);

  const all = data?.items || [];
  const categories = useMemo(() => [...new Set(all.map((i) => i.category))].sort(), [all]);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((i) => (status === 'all' || i.status === status) && (!category || i.category === category) && (!needle || `${i.name} ${i.brand || ''} ${i.size}`.toLowerCase().includes(needle)))
      .sort(SORTS[sort]);
  }, [all, q, status, category, sort]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  const count = (s) => all.filter((i) => i.status === s).length;
  const filtered = q || status !== 'all' || category;

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 flex-none place-items-center rounded-[18px] bg-linear-to-br from-brand-2 to-brand text-white shadow-[0_12px_24px_-12px_rgba(16,185,129,0.8)]">
            <Package size={26} />
          </span>
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.025em]">Inventory</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-3">Check availability and take action on what’s in stock.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionChip icon={MessageCircle} tone="ok" onClick={() => navigate('/staff/share-prices')}>
            Share Prices
          </ActionChip>
          <ActionChip icon={ClipboardList} tone="brand" onClick={() => navigate('/staff/count')}>
            Physical Count
          </ActionChip>
          <ActionChip icon={Undo2} tone="info" onClick={() => setBorrowing(true)}>
            Borrow / Lend
          </ActionChip>
          <ActionChip icon={PackageSearch} tone="profit" onClick={() => navigate('/staff/on-demand-purchases')}>
            On-Demand Purchase
          </ActionChip>
          {shops.length > 1 && (
            <ActionChip icon={ArrowLeftRight} tone="warn" onClick={() => setTransferring(true)}>
              Transfer Stock
            </ActionChip>
          )}
        </div>
      </div>

      <StatBar
        items={[
          { key: 'total', label: 'Total products', value: num(all.length), icon: Package, iconTone: 'brand', footer: `${categories.length} categories` },
          { key: 'in', label: 'In stock', value: num(count('in')), icon: Package, iconTone: 'info', footer: 'products available' },
          { key: 'low', label: 'Low stock', value: num(count('low')), icon: AlertTriangle, iconTone: 'warn', footer: count('low') ? 'needs attention' : 'nothing running low' },
          { key: 'out', label: 'Out of stock', value: num(count('out')), icon: Ban, iconTone: 'bad', footer: 'currently unavailable' },
        ]}
      />

      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative min-w-0 flex-1 basis-full sm:basis-[260px] lg:max-w-[360px]">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input className="input h-10 border-transparent bg-surface-2 pl-10 focus:bg-surface" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks, e.g. coke 50cl" aria-label="Search drinks" />
          </label>
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-auto min-w-[160px] flex-1 border-transparent bg-surface-2 sm:flex-none">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select aria-label="Stock status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px] flex-1 border-transparent bg-surface-2 sm:flex-none">
            <option value="all">All stock status</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-[12px] border border-line bg-surface px-3 text-[13px] text-ink-3 shadow-[0_1px_2px_rgba(16,24,32,0.03)]">
              <SlidersHorizontal size={14} />
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-[13.5px] font-semibold text-ink outline-none" aria-label="Sort by">
                <option value="name">Name</option>
                <option value="stock">Most stock</option>
                <option value="price">Highest price</option>
              </select>
            </label>
            <div role="group" aria-label="View" className="flex rounded-[12px] border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,32,0.03)]">
              {[
                ['list', Package, 'List view'],
                ['grid', LayoutGrid, 'Grid view'],
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                  className={cn('grid size-8 place-items-center rounded-[9px] transition-colors', view === key ? 'bg-brand text-on-brand shadow-[0_4px_10px_-6px_var(--brand-2)]' : 'text-ink-3 hover:text-ink')}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title={filtered ? 'No drinks match these filters' : 'No drinks in stock yet'} text={filtered ? 'Try another search, or clear the filters.' : 'Products your admin adds show up here.'} action={filtered ? <Button onClick={() => { setQ(''); setStatus('all'); setCategory(''); }}>Clear filters</Button> : null} />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {items.map((i) => (
            <div key={i.variantId} className="card card-lift flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <ProductThumb product={i} size={46} />
                <div className="min-w-0">
                  <b className="block truncate text-[14px] font-semibold">{i.productName}</b>
                  <small className="text-[12px] text-ink-3">{i.size}</small>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="tnum text-[18px] font-bold">{i.status === 'out' ? '—' : describeStock(i)}</div>
                  <div className="text-[12px] text-ink-3">{money(i.sellingPrice)} per bottle</div>
                </div>
                <StockBadge status={i.status} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card flush className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Size &amp; price</th>
                  <th>Stock level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.variantId}>
                    <td>
                      <span className="flex items-center gap-3">
                        <ProductThumb product={i} size={42} />
                        <span className="min-w-0">
                          <b className="block truncate font-semibold">{i.productName}</b>
                          <small className="text-[12px] text-ink-3">{i.category}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex rounded-[7px] bg-surface-2 px-2 py-0.5 text-[12.5px] font-semibold shadow-[inset_0_0_0_1px_var(--line)]">{i.size}</span>
                      <div className="tnum mt-1 text-[12.5px] text-ink-3">
                        {money(i.sellingPrice)} per {UNIT_LABEL[i.unit]?.toLowerCase() || 'bottle'}
                      </div>
                    </td>
                    <td>
                      <b className="tnum font-semibold">{i.status === 'out' ? 'None left' : describeStock(i)}</b>
                      <div className="tnum mt-0.5 text-[12px] text-ink-3">{plural(i.quantity, 'bottle')}</div>
                    </td>
                    <td>
                      <StockBadge status={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TransferModal open={transferring} onClose={() => setTransferring(false)} onDone={reload} />
      <BorrowModal open={borrowing} onClose={() => setBorrowing(false)} onDone={reload} />
    </Page>
  );
}

const CHIP_TONE = {
  ok: 'text-ok',
  brand: 'text-brand',
  info: 'text-info',
  warn: 'text-warn',
  profit: 'text-profit',
};

/** Quick-action pill used across the staff header: an icon, a label, and a light card surface. */
function ActionChip({ icon: Icon, tone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2.5 rounded-[14px] border border-line bg-surface px-4 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_12px_24px_-16px_rgba(4,120,87,0.4)]"
    >
      <Icon size={17} className={CHIP_TONE[tone]} />
      {children}
    </button>
  );
}
