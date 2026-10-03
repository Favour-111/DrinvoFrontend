import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Search } from '../../components/icons.js';
import { Page, Chips } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { inventoryService, stockCountService } from '../../services/index.js';
import { plural } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

/** One product row: a narrow number box per unit it's sold in, filled in directly in the list —
 * no tap-to-open-a-form step, so counting the whole shop is just scrolling and typing. */
function CountRow({ product, value, onChange }) {
  const units = availableUnits(product);
  const total = units.reduce((s, u) => s + (Number(value?.[u]) || 0) * conversionFor(product, u), 0);
  const touched = units.some((u) => value?.[u] !== undefined && value[u] !== '');
  const diff = total - product.quantity;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-2 px-4 py-3 last:border-0', touched && 'bg-brand-soft/30')}>
      <ProductThumb product={product} size={34} />
      <div className="min-w-0 flex-1 basis-40">
        <b className="block truncate text-[13.5px] font-semibold">{product.name}</b>
        <small className="text-[12px] text-ink-3">System: {describeStock(product)}</small>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {units.map((u) => (
          <label key={u} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-ink-3">{UNIT_LABEL[u].slice(0, 3)}</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="0"
              value={value?.[u] ?? ''}
              onChange={(e) => onChange(u, e.target.value)}
              className="input h-9 w-[58px] px-1.5 text-center text-[13px]"
              aria-label={`${UNIT_LABEL[u]} count for ${product.name}`}
            />
          </label>
        ))}
      </div>
      {touched && (
        <span className={cn('flex-none text-[11.5px] font-semibold', diff === 0 ? 'text-ink-3' : diff > 0 ? 'text-ok' : 'text-bad')}>
          {plural(total, 'bottle')}
          {diff !== 0 && <> ({diff > 0 ? '+' : ''}{diff})</>}
        </span>
      )}
    </div>
  );
}

export default function StockCount() {
  const { shop } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Shared between the staff and admin routes — only the staff layout has a fixed bottom tab
  // bar the floating submit button needs to clear, and the two land somewhere different after submit.
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
    <Page className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">Physical Stock Count</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Counting at {shop?.name}. Enter what you counted for each product — leave the rest blank.</p>
        </div>
        <b className="tnum text-[13.5px] text-ink-2">{plural(countedCount, 'product')} counted</b>
      </div>

      <label className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input className="input h-11 pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks" aria-label="Search products" />
      </label>
      <Chips label="Category" options={categories.map((c) => [c, c])} value={category} onChange={setCategory} />

      {error && <div className="rounded-[14px] border border-bad/15 bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad">{error}</div>}

      <Card flush className="py-1">
        {list.length ? (
          list.map((p) => <CountRow key={p.variantId} product={p} value={values[p.variantId]} onChange={(unit, raw) => setUnit(p.variantId, unit, raw)} />)
        ) : (
          <EmptyState icon={Search} title="No drinks found" text="Try another search or category." />
        )}
      </Card>

      {countedCount > 0 && (
        <div
          className={cn(
            'fixed inset-x-0 z-40 mx-auto flex w-[min(640px,calc(100%-24px))] items-center justify-between gap-3 rounded-[16px] border border-line bg-ink px-4 py-3 text-surface-solid shadow-pop',
            isStaff ? 'bottom-[calc(78px+env(safe-area-inset-bottom))] md:bottom-4' : 'bottom-4'
          )}
        >
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setClearing(true)} className="text-[12.5px] font-semibold opacity-75 hover:opacity-100">
              Clear all
            </button>
          </div>
          <Button variant="primary" icon={Check} loading={submitting} onClick={submit}>
            Submit Count · {plural(countedCount, 'product')}
          </Button>
        </div>
      )}

      {!countedCount && <div className="h-2" />}

      <ConfirmDialog open={clearing} onClose={() => setClearing(false)} onConfirm={async () => setValues({})} title="Clear this count?" confirmLabel="Clear all" icon={ClipboardList}>
        <p>Everything entered so far will be cleared. Nothing has been submitted yet.</p>
      </ConfirmDialog>
    </Page>
  );
}
