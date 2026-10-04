import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ClipboardList, Package, RotateCcw, Search, Store, User } from '../../components/icons.js';
import { Page, Chips } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { inventoryService, stockCountService } from '../../services/index.js';
import { isoDate, num, plural, shortDateTime } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, UNIT_LABEL, UNITS } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const GRID = 'md:grid-cols-[minmax(230px,2.1fr)_minmax(90px,0.8fr)_minmax(180px,1.5fr)_minmax(200px,1.6fr)_minmax(90px,0.7fr)_minmax(96px,0.8fr)_minmax(96px,0.8fr)]';

/** A unit-breakdown chip: what one unit of this product is worth in bottles. */
function UnitChip({ unit, product }) {
  const conv = conversionFor(product, unit);
  return (
    <span className="inline-flex flex-col rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[11.5px] leading-tight text-ink-2">
      <b className="font-semibold">{UNIT_LABEL[unit]}</b>
      <span className="text-[10.5px] text-ink-3">{conv} bottle{conv === 1 ? '' : 's'}</span>
    </span>
  );
}

/** One product row. Each unit it's sold in gets its own count box, filled in directly in the list. */
function CountRow({ product, value, onChange }) {
  const units = availableUnits(product);
  const total = units.reduce((s, u) => s + (Number(value?.[u]) || 0) * conversionFor(product, u), 0);
  const touched = units.some((u) => value?.[u] !== undefined && value[u] !== '');
  const diff = total - product.quantity;
  const bigUnits = UNITS.filter((u) => u !== 'bottle' && conversionFor(product, u));
  const conversionText = bigUnits.map((u) => `1 ${UNIT_LABEL[u].toLowerCase()} = ${conversionFor(product, u)} bottles`).join(' · ') || 'Sold by the bottle';

  return (
    <div className={cn('grid gap-3 border-b border-line-2 px-4 py-3.5 transition-colors last:border-0 md:items-center md:gap-3 md:px-5', GRID, touched ? 'bg-brand-soft/40' : 'hover:bg-surface-2/60')}>
      <div className="flex min-w-0 items-center gap-3">
        <ProductThumb product={product} size={44} />
        <div className="min-w-0">
          <b className="block truncate text-[14px] font-semibold">{product.name}</b>
          <small className="block truncate text-[12px] text-ink-3">{conversionText}</small>
        </div>
      </div>
      <div className="hidden md:block">
        <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">{product.category}</span>
      </div>
      <div className="hidden flex-wrap gap-1.5 md:flex">
        {units.map((u) => (
          <UnitChip key={u} unit={u} product={product} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[52px] text-[11px] font-semibold text-ink-3 md:hidden">Count</span>
        {units.map((u) => (
          <label key={u} className="flex flex-col items-center gap-1">
            <span className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-3 uppercase">{UNIT_LABEL[u]}s</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="0"
              value={value?.[u] ?? ''}
              onChange={(e) => onChange(u, e.target.value)}
              className={cn('input h-10 w-[68px] px-1.5 text-center text-[14px] font-semibold', touched && value?.[u] ? 'border-brand/50 bg-surface' : '')}
              aria-label={`${UNIT_LABEL[u]} count for ${product.name}`}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 md:block md:text-center">
        <span className="text-[11px] font-semibold text-ink-3 md:hidden">Total units</span>
        <span className="tnum text-[15px] font-bold">
          {plural(total, 'bottle')}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 md:block md:text-center">
        <span className="text-[11px] font-semibold text-ink-3 md:hidden">System</span>
        <span className="tnum text-[13px] font-semibold text-ink-2">{product.quantity}</span>
      </div>
      <div className="flex items-center justify-between gap-2 md:block md:text-center">
        <span className="text-[11px] font-semibold text-ink-3 md:hidden">Variance</span>
        {touched ? (
          <Badge tone={diff === 0 ? 'neutral' : diff > 0 ? 'ok' : 'bad'}>{diff === 0 ? 'Matches' : `${diff > 0 ? '+' : ''}${num(diff)}`}</Badge>
        ) : (
          <span className="text-[13px] text-ink-3">—</span>
        )}
      </div>
    </div>
  );
}

export default function StockCount() {
  const { shop, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Shared between the staff and admin routes — only the staff layout has a fixed bottom tab
  // bar the floating submit bar needs to clear, and the two land somewhere different after submit.
  const isStaff = useLocation().pathname.startsWith('/staff');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [values, setValues] = useState({}); // { variantId: { bottle: '3', carton: '1' } }
  const [clearing, setClearing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { data, error: loadError, reload } = useApi(() => inventoryService.list(), []);

  const categories = useMemo(() => ['All', ...new Set((data?.items || []).map((p) => p.category))], [data]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items || []).filter((p) => (category === 'All' || p.category === category) && (!needle || p.name.toLowerCase().includes(needle)));
  }, [data, q, category]);

  if (loadError && !data) return <ErrorState error={loadError} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  const setUnit = (variantId, unit, raw) => setValues((v) => ({ ...v, [variantId]: { ...v[variantId], [unit]: raw } }));

  const countedIds = Object.keys(values).filter((id) => Object.values(values[id] || {}).some((v) => v !== '' && v !== undefined));
  const countedCount = countedIds.length;
  const totalProducts = data.items.length;
  const remaining = Math.max(0, totalProducts - countedCount);
  const percent = totalProducts ? Math.round((countedCount / totalProducts) * 100) : 0;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const items = countedIds.map((variantId) => {
        const product = data.items.find((p) => p.variantId === variantId);
        const counts = availableUnits(product)
          .filter((u) => values[variantId]?.[u] !== undefined && values[variantId]?.[u] !== '')
          .map((u) => ({ unit: u, quantity: Number(values[variantId][u]) || 0 }));
        return { variantId, counts };
      });
      await stockCountService.create({ items });
      toast.success(`Physical count submitted · ${plural(items.length, 'product')}.`);
      navigate(isStaff ? '/staff/inventory' : '/admin/stock-counts');
    } catch (err) {
      setError(err.message || 'Could not submit this count.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className={cn(isStaff ? 'pb-40 md:pb-28' : 'pb-28')}>
      <button type="button" onClick={() => navigate(isStaff ? '/staff/inventory' : '/admin/stock-counts')} className="inline-flex w-fit items-center gap-2 text-[13.5px] font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowRight size={15} className="rotate-180" />
        Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 flex-none place-items-center rounded-[18px] bg-linear-to-br from-brand-soft to-surface-2 text-brand shadow-[inset_0_0_0_1px_var(--line)]">
            <ClipboardList size={26} />
          </span>
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em] sm:text-[26px]">Physical Stock Count</h1>
            <p className="mt-0.5 max-w-[560px] text-[13.5px] text-ink-3">Count what you have at {shop?.name}. Enter cartons, packs and bottles — leave what you haven’t counted blank.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContextChip icon={CalendarDays} label="Date" value={shortDateTime(new Date())} />
          <ContextChip icon={Store} label="Shop" value={shop?.name} />
          <ContextChip icon={User} label="Counted by" value={user?.name} />
        </div>
      </div>

      <StatBar
        items={[
          { key: 'total', label: 'Total products', value: num(totalProducts), icon: Package, iconTone: 'info', footer: 'to count' },
          { key: 'counted', label: 'Counted', value: num(countedCount), icon: Check, iconTone: 'ok', footer: `${percent}% completed` },
          { key: 'remaining', label: 'Remaining', value: num(remaining), icon: RotateCcw, iconTone: 'warn', footer: 'products left' },
          { key: 'progress', label: 'Progress', value: `${percent}%`, icon: ClipboardList, iconTone: 'brand', footer: <ProgressBar percent={percent} /> },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-0 flex-1 sm:max-w-[420px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input className="input h-11 border-transparent bg-surface pl-10 shadow-[0_6px_18px_-14px_rgba(16,24,32,0.35)]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks" aria-label="Search products" />
        </label>
      </div>
      <Chips label="Category" options={categories.map((c) => [c, c])} value={category} onChange={setCategory} />

      {error && <div className="rounded-[14px] border border-bad/15 bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad">{error}</div>}

      <Card flush className="overflow-hidden">
        <div className={cn('hidden gap-3 border-b border-line bg-surface-2/70 px-5 py-3 text-[12px] font-semibold text-ink-3 md:grid', GRID)}>
          <span>Product</span>
          <span>Category</span>
          <span>Unit breakdown</span>
          <span>Your count</span>
          <span className="text-center">Total units</span>
          <span className="text-center">System</span>
          <span className="text-center">Variance</span>
        </div>
        {list.length ? (
          list.map((p) => <CountRow key={p.variantId} product={p} value={values[p.variantId]} onChange={(unit, raw) => setUnit(p.variantId, unit, raw)} />)
        ) : (
          <EmptyState icon={Search} title="No drinks found" text="Try another search or category." />
        )}
      </Card>

      {countedCount > 0 && (
        <div
          className={cn(
            'fixed inset-x-0 z-40 mx-auto flex w-[min(720px,calc(100%-24px))] items-center justify-between gap-3 rounded-[18px] border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur-md',
            isStaff ? 'bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-4' : 'bottom-4'
          )}
        >
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{plural(countedCount, 'product')} counted</div>
            <div className="text-[12px] text-ink-3">{remaining} still to count</div>
          </div>
          <div className="flex items-center gap-2">
            <Button icon={RotateCcw} onClick={() => setClearing(true)}>
              Reset
            </Button>
            <Button variant="primary" icon={Check} loading={submitting} onClick={submit}>
              Submit count
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog open={clearing} onClose={() => setClearing(false)} onConfirm={async () => setValues({})} title="Reset this count?" confirmLabel="Reset count" icon={RotateCcw}>
        <p>Everything entered so far will be cleared. Nothing has been submitted yet.</p>
      </ConfirmDialog>
    </Page>
  );
}

function ContextChip({ icon: Icon, label, value }) {
  return (
    <span className="inline-flex h-11 items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 shadow-[0_1px_2px_rgba(16,24,32,0.04)]">
      <Icon size={15} className="text-brand" />
      <span className="min-w-0">
        <span className="block text-[10.5px] leading-none text-ink-3 uppercase">{label}</span>
        <span className="block max-w-[180px] truncate text-[13px] font-semibold">{value}</span>
      </span>
    </span>
  );
}

function ProgressBar({ percent }) {
  return (
    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <span className="block h-full rounded-full bg-linear-to-r from-brand-2 to-brand transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </span>
  );
}
