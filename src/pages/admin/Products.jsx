import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bottle, Eye, Layers, MessageCircle, Pencil, Plus, RotateCcw, Search, Trash2, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { ButtonLink, Button, IconButton } from '../../components/ui/Button.jsx';
import { StockBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton, TableSkeleton } from '../../components/ui/Feedback.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { ProductCell, ProductThumb } from '../../components/ui/Media.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { useStockUpdates } from '../../hooks/useStockUpdates.js';
import { useToast } from '../../context/ToastContext.jsx';
import { productService } from '../../services/index.js';
import { cn } from '../../utils/cn.js';
import { money, num, plural } from '../../utils/format.js';
import { describeStock, mergeStockRows } from '../../utils/units.js';

/** Stock level as a thin meter against three times the low-stock line, coloured by status. */
function StockMeter({ row }) {
  const ceiling = Math.max(row.lowStockThreshold * 3, row.quantity, 1);
  const pct = Math.min(100, (row.quantity / ceiling) * 100);
  const tone = row.status === 'out' ? 'bg-bad' : row.status === 'low' ? 'bg-warn' : 'bg-brand-2';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <b className="tnum text-[13.5px] font-semibold">{num(row.quantity)} bottles</b>
        <StockBadge status={row.status} />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${pct}%` }} />
      </div>
      <small className="text-[12px] text-ink-3">{describeStock(row)}</small>
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [archiving, setArchiving] = useState(null);
  const debounced = useDebounce(q);
  const navigate = useNavigate();
  const toast = useToast();

  const categories = useApi(() => productService.categories(), []);
  const { data, error, loading, reload, setData } = useApi(
    () => productService.list({ q: debounced, category, ...(status === 'ARCHIVED' ? { status } : { stock: status }) }),
    [debounced, category, status]
  );

  const matchesStatus = (row) => (status === 'ARCHIVED' ? row.status === 'archived' : !status || row.status === status);
  useStockUpdates((rows) => setData((d) => (d ? { ...d, items: mergeStockRows(d.items, rows).filter(matchesStatus) } : d)));

  const onSearch = (v) => {
    setQ(v);
    setParams(v ? { q: v } : {}, { replace: true });
  };

  const setArchived = async (row, archived) => {
    try {
      await (archived ? productService.archive(row.productId) : productService.restore(row.productId));
      toast.success(archived ? 'Product archived.' : 'Product restored.');
      reload();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  const products = new Set(data.items.map((i) => i.productId)).size;
  const filtered = q || category || status;

  return (
    <Page>
      <PageHeader
        title="Products"
        subtitle={`${plural(products, 'product')} · ${plural(data.items.length, 'size')}${filtered ? ' shown' : ''}`}
        actions={
          <>
            <ButtonLink to="/admin/share-prices" icon={MessageCircle}>
              Share Prices
            </ButtonLink>
            <ButtonLink to="/admin/products/new" variant="primary" icon={Plus}>
              Add Product
            </ButtonLink>
          </>
        }
      />
      <StatBar
        items={[
          { key: 'products', label: 'Products', value: num(products), icon: Bottle, iconTone: 'brand', footer: 'in this view' },
          { key: 'sizes', label: 'Sizes', value: num(data.items.length), icon: Layers, iconTone: 'info', footer: 'variants across all shops' },
          { key: 'value', label: 'Stock value', value: money(data.items.reduce((n, v) => n + v.quantity * v.avgCost, 0)), icon: Wallet, iconTone: 'ok', footer: 'at average cost' },
          { key: 'attention', label: 'Needs restocking', value: num(data.items.filter((v) => v.status === 'low' || v.status === 'out').length), icon: AlertTriangle, iconTone: 'warn', footer: 'low or out of stock' },
        ]}
      />

      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:max-w-[340px] sm:flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input className="input h-10 border-transparent bg-surface-2 pl-10 focus:bg-surface" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search products, brands or sizes" aria-label="Search products" />
          </label>
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-auto min-w-[160px] flex-1 border-transparent bg-surface-2 sm:flex-none">
            <option value="">All categories</option>
            {(categories.data || []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px] flex-1 border-transparent bg-surface-2 sm:flex-none">
            <option value="">All statuses</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </Card>

      <Card flush>
        {loading && !data.items.length ? (
          <TableSkeleton />
        ) : data.items.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Cost Price</th>
                  <th className="num">Selling Price</th>
                  <th>Stock</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {data.items.map((v) => (
                  <tr key={v.variantId} className="row-link" onClick={() => navigate(`/admin/products/${v.productId}`)}>
                    <td>
                      <ProductCell product={v} name={v.productName} sub={[v.brand, v.size].filter(Boolean).join(' · ')} />
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
                        <i className="size-2 rounded-full" style={{ background: v.color || 'var(--brand-2)' }} />
                        {v.category}
                      </span>
                    </td>
                    <td className="num">{money(v.avgCost)}</td>
                    <td className="num">
                      <b className="font-semibold">{money(v.sellingPrice)}</b>
                      {v.minimumSellingPrice > 0 && <small className="block text-[11.5px] text-ink-3">min {money(v.minimumSellingPrice)}</small>}
                    </td>
                    <td className="min-w-[180px]">
                      <StockMeter row={v} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <IconButton size={32} icon={Eye} label="View" onClick={() => navigate(`/admin/products/${v.productId}`)} />
                        <IconButton size={32} icon={Pencil} label="Edit" onClick={() => navigate(`/admin/products/${v.productId}/edit`)} />
                        {v.status === 'archived' ? (
                          <IconButton size={32} icon={RotateCcw} label="Restore" onClick={() => setArchived(v, false).catch(() => {})} />
                        ) : (
                          <IconButton size={32} icon={Trash2} label="Delete" onClick={() => setArchiving(v)} className="hover:border-bad/40 hover:bg-bad-soft hover:text-bad" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered ? (
          <EmptyState
            icon={Search}
            title="No products match"
            text="Try another search term or clear the filters."
            action={
              <Button
                onClick={() => {
                  onSearch('');
                  setCategory('');
                  setStatus('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Bottle}
            title="No products yet"
            text="Add your first drink to start managing your inventory."
            action={
              <ButtonLink to="/admin/products/new" variant="primary" icon={Plus}>
                Add Product
              </ButtonLink>
            }
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => setArchived(archiving, true)}
        title={`Delete ${archiving?.productName}?`}
        confirmLabel="Delete product"
        icon={Trash2}
      >
        <p>Every size of this product will be hidden from staff and can no longer be sold. Its stock stays recorded.</p>
        <p>Sales history is kept. You can restore it later from the Archived filter.</p>
      </ConfirmDialog>
    </Page>
  );
}
