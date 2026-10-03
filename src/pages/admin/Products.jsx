import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, Bottle, Eye, MessageCircle, Pencil, Plus, RotateCcw, Search } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ButtonLink, Button, IconButton } from '../../components/ui/Button.jsx';
import { StockBadge, Tag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton, TableSkeleton } from '../../components/ui/Feedback.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { ProductCell } from '../../components/ui/Media.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { useStockUpdates } from '../../hooks/useStockUpdates.js';
import { useToast } from '../../context/ToastContext.jsx';
import { productService } from '../../services/index.js';
import { money, num, plural } from '../../utils/format.js';
import { describeStock, mergeStockRows } from '../../utils/units.js';

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
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full sm:w-auto sm:max-w-[360px] sm:flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search products" aria-label="Search products" />
        </label>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[150px] flex-1 sm:flex-none">
          <option value="">All categories</option>
          {(categories.data || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[150px] flex-1 sm:flex-none">
          <option value="">All statuses</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      <Card flush>
        {loading && !data.items.length ? (
          <TableSkeleton />
        ) : data.items.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[960px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Category</th>
                  <th className="num">Cost Price</th>
                  <th className="num">Selling Price</th>
                  <th className="num">Minimum Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {data.items.map((v) => (
                  <tr key={v.variantId} className="row-link" onClick={() => navigate(`/admin/products/${v.productId}`)}>
                    <td>
                      <ProductCell product={v} name={v.productName} sub={v.brand} />
                    </td>
                    <td>
                      <Tag>{v.size}</Tag>
                    </td>
                    <td>{v.category}</td>
                    <td className="num">{money(v.avgCost)}</td>
                    <td className="num font-semibold">{money(v.sellingPrice)}</td>
                    <td className="num text-ink-3">{v.minimumSellingPrice > 0 ? money(v.minimumSellingPrice) : '—'}</td>
                    <td className="tnum">
                      <b className="font-semibold">{num(v.quantity)} bottles</b>
                      <br />
                      <small className="text-[12px] text-ink-3">{describeStock(v)}</small>
                    </td>
                    <td>
                      <StockBadge status={v.status} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <IconButton size={32} icon={Eye} label="View" onClick={() => navigate(`/admin/products/${v.productId}`)} />
                        <IconButton size={32} icon={Pencil} label="Edit" onClick={() => navigate(`/admin/products/${v.productId}/edit`)} />
                        {v.status === 'archived' ? (
                          <IconButton size={32} icon={RotateCcw} label="Restore" onClick={() => setArchived(v, false).catch(() => {})} />
                        ) : (
                          <IconButton size={32} icon={Archive} label="Archive" onClick={() => setArchiving(v)} />
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
        title={`Archive ${archiving?.productName}?`}
        confirmLabel="Archive product"
        icon={Archive}
      >
        <p>Every size of this product will be hidden from staff and can no longer be sold. Its stock stays recorded.</p>
        <p>Sales history is kept. You can restore it later from the Archived filter.</p>
      </ConfirmDialog>
    </Page>
  );
}
