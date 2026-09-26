import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Ban, ChevronRight, Package, Search, SlidersHorizontal, Truck, Wallet } from '../../components/icons.js';
import { Page, PageHeader, Tabs } from '../../components/ui/Nav.jsx';
import { Card, StatCard } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StockBadge, Tag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductCell } from '../../components/ui/Media.jsx';
import { AdjustModal, RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { useStockUpdates } from '../../hooks/useStockUpdates.js';
import { inventoryService } from '../../services/index.js';
import { money, num } from '../../utils/format.js';
import { equivalent, mergeStockRows, summarizeStock } from '../../utils/units.js';

function Equivalent({ item, unit }) {
  const e = equivalent(item, unit);
  if (!e) return <span className="text-ink-3">—</span>;
  return (
    <span className="tnum">
      {num(e.whole)}
      {e.rest > 0 && <small className="ml-1 text-[12px] text-ink-3">+{e.rest} btl</small>}
    </span>
  );
}

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const debounced = useDebounce(q);
  const navigate = useNavigate();
  const { data, error, loading, reload, setData } = useApi(() => inventoryService.list({ q: debounced, status }), [debounced, status]);

  // Filtered/searched views can't recompute exact totals from a partial row set, so only
  // patch the summary card when showing everything; the row list itself always stays live.
  useStockUpdates((rows) =>
    setData((d) => {
      if (!d) return d;
      const items = mergeStockRows(d.items, rows).filter((r) => status === 'all' || r.status === status);
      const summary = status === 'all' && !debounced ? summarizeStock(items) : d.summary;
      return { ...d, items, summary };
    })
  );

  const setStatus = (s) => setParams(s === 'all' ? {} : { status: s }, { replace: true });

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const { items, summary } = data;

  return (
    <Page>
      <PageHeader
        title="Inventory"
        subtitle="Stock is stored in bottles and shown in every unit you sell."
        actions={
          <>
            <Button icon={SlidersHorizontal} onClick={() => setModal({ type: 'adjust' })}>
              Adjust stock
            </Button>
            <Button variant="primary" icon={Truck} onClick={() => setModal({ type: 'restock' })}>
              Restock
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard dark label="Total Stock" value={num(summary.totalBottles)} icon={Package} footer={`bottles across ${summary.variantCount} sizes of ${summary.productCount} products`} />
        <button type="button" onClick={() => setStatus('low')} className="text-left">
          <StatCard label="Low Stock" value={summary.lowStock} icon={AlertTriangle} iconTone="warn" footer="at or below alert level" />
        </button>
        <button type="button" onClick={() => setStatus('out')} className="text-left">
          <StatCard label="Out of Stock" value={summary.outOfStock} icon={Ban} iconTone="bad" footer="staff can’t sell these" />
        </button>
        <StatCard label="Inventory Value" value={money(summary.inventoryValue)} icon={Wallet} footer="at weighted average cost" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full sm:w-auto sm:max-w-[360px] sm:flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" aria-label="Search stock" />
        </label>
        <Tabs
          label="Stock status"
          value={status}
          onChange={setStatus}
          options={[
            ['all', 'All'],
            ['in', 'In stock'],
            ['low', 'Low'],
            ['out', 'Out'],
          ]}
        />
      </div>

      <Card flush>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th className="num">Bottle Stock</th>
                  <th className="num">Packs</th>
                  <th className="num">Cartons</th>
                  <th className="num">Crates</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {items.map((i) => (
                  <tr key={i.variantId} className="row-link" onClick={() => navigate(`/admin/inventory/${i.variantId}`)}>
                    <td>
                      <ProductCell product={i} name={i.productName} size={36} />
                    </td>
                    <td>
                      <Tag>{i.size}</Tag>
                    </td>
                    <td className="num font-semibold">{num(i.quantity)}</td>
                    <td className="num">
                      <Equivalent item={i} unit="pack" />
                    </td>
                    <td className="num">
                      <Equivalent item={i} unit="carton" />
                    </td>
                    <td className="num">
                      <Equivalent item={i} unit="crate" />
                    </td>
                    <td>
                      <StockBadge status={i.status} />
                    </td>
                    <td className="num text-ink-3">
                      <ChevronRight size={16} className="ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Search} title="Nothing here" text="No stock matches this search or filter." action={<Button onClick={() => { setQ(''); setStatus('all'); }}>Show all stock</Button>} />
        )}
      </Card>

      <RestockModal open={modal?.type === 'restock'} onClose={() => setModal(null)} onDone={reload} />
      <AdjustModal open={modal?.type === 'adjust'} onClose={() => setModal(null)} onDone={reload} />
    </Page>
  );
}
