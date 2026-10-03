import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Mail, MapPin, Pencil, Phone, RotateCcw, Trash2, Truck, User } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SupplierModal, DeleteSupplierModal } from '../../components/modals/EntityModals.jsx';
import { RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { supplierService } from '../../services/index.js';
import { fmtDate, initials, money, plural } from '../../utils/format.js';

export default function SupplierDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => supplierService.get(id), [id]);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;
  const { supplier, stats, products, purchases } = data;
  const archived = supplier.status === 'ARCHIVED';

  const restore = async () => {
    try {
      await supplierService.restore(id);
      toast.success('Supplier restored.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader
        crumbs={[['Suppliers', '/admin/suppliers'], [supplier.name]]}
        subtitle={`Supplier since ${fmtDate(supplier.createdAt)}`}
        actions={
          archived ? (
            <Button icon={RotateCcw} onClick={restore}>
              Restore supplier
            </Button>
          ) : (
            <>
              <Button icon={Pencil} onClick={() => setModal('edit')}>
                Edit
              </Button>
              <Button variant="danger-soft" icon={Trash2} onClick={() => setModal('delete')}>
                Delete
              </Button>
              <Button variant="primary" icon={Truck} onClick={() => setModal('restock')}>
                Restock from supplier
              </Button>
            </>
          )
        }
      >
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-[13px] bg-surface-3 text-[18px] font-bold">{initials(supplier.name)}</span>
          <h1 className="flex items-center gap-2.5 text-[22px] font-bold sm:text-[24px]">
            {supplier.name}
            {archived && <Badge tone="bad">Deleted</Badge>}
          </h1>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Total purchases" value={money(stats.totalPurchases)} />
        <MiniStat label="Restocks" value={stats.purchaseCount} />
        <MiniStat label="Products" value={stats.productCount} />
        <MiniStat label="Last restock" value={stats.lastPurchaseAt ? fmtDate(stats.lastPurchaseAt) : '—'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="self-start">
          <h3 className="mb-3.5 text-[16px] font-semibold">Contacts</h3>
          <div className="flex flex-col gap-3">
            {(supplier.contacts || []).map((c, i) => (
              <div key={i} className={i > 0 ? 'border-t border-line-2 pt-3' : ''}>
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <User size={16} className="flex-none text-ink-3" />
                  {c.name}
                </div>
                <div className="mt-1.5 grid gap-1.5 pl-[24px] text-[13.5px]">
                  {c.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone size={15} className="flex-none text-ink-3" />
                      <span className="min-w-0 break-words select-all">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail size={15} className="flex-none text-ink-3" />
                      <span className="min-w-0 break-words select-all">{c.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {supplier.address && (
              <div className="flex items-center gap-3 border-t border-line-2 pt-3 text-[14px]">
                <MapPin size={17} className="flex-none text-ink-3" />
                <span className="min-w-0 break-words select-all">{supplier.address}</span>
              </div>
            )}
          </div>
          <h3 className="mt-6 mb-2 text-[16px] font-semibold">Products supplied</h3>
          {products.length ? (
            products.map((p) => (
              <Link key={p.id} to={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-xl border-b border-line-2 py-3 last:border-0 hover:bg-surface-2">
                <ProductThumb product={p} size={34} />
                <div className="min-w-0 flex-1">
                  <b className="font-semibold">{p.name}</b>
                  <small className="block text-[12.5px] text-ink-3">{p.category}</small>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))
          ) : (
            <p className="hint">No products link to this supplier yet. Set the main supplier when editing a product.</p>
          )}
        </Card>

        <Card flush>
          <CardHeader flush title="Restock History" />
          {purchases.length ? (
            <div className="overflow-x-auto">
              <table className="table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th className="num">Total</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.purchaseNumber}</td>
                      <td className="text-ink-3">{fmtDate(p.createdAt)}</td>
                      <td className="!whitespace-normal">
                        {p.items.map((i) => (
                          <div key={i.variantId}>
                            {plural(i.quantity, i.unit)} {i.name}
                          </div>
                        ))}
                      </td>
                      <td className="num font-semibold">{money(p.totalCost)}</td>
                      <td>{p.createdBy?.name.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Truck} title="No restocks yet" text="Restocks from this supplier will be listed here." />
          )}
        </Card>
      </div>

      <SupplierModal open={modal === 'edit'} onClose={() => setModal(null)} supplier={supplier} onDone={reload} />
      <RestockModal open={modal === 'restock'} onClose={() => setModal(null)} supplierId={id} onDone={reload} />
      <DeleteSupplierModal open={modal === 'delete'} onClose={() => setModal(null)} supplier={supplier} onDone={reload} />
    </Page>
  );
}
