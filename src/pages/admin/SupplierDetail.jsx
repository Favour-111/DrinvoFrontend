import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, ChevronRight, Clock, Layers, Mail, MapPin, Package, Pencil, Phone, RotateCcw, ShoppingCart, Trash2, Truck, User, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SupplierModal, DeleteSupplierModal } from '../../components/modals/EntityModals.jsx';
import { RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { supplierService } from '../../services/index.js';
import { fmtDate, initials, money, num, plural } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const AVATAR_TONES = ['bg-brand-soft text-brand-ink', 'bg-info-soft text-info', 'bg-warn-soft text-warn', 'bg-ok-soft text-ok', 'bg-surface-3 text-ink-2'];
const toneFor = (name = '') => AVATAR_TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

/** A contact person as a tinted tile: name on top, then tap-to-copy phone and email lines. */
function ContactTile({ contact, label }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[16px] border border-line-2 bg-surface-2/60 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-[11px] bg-surface text-brand shadow-[inset_0_0_0_1px_var(--line)]">
          <User size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{label}</div>
          <div className="truncate text-[14px] font-semibold">{contact.name}</div>
        </div>
      </div>
      <div className="grid gap-2 pl-1 text-[13px]">
        {contact.phone ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Phone size={14} className="flex-none text-ink-3" />
            <span className="min-w-0 truncate tnum select-all">{contact.phone}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-ink-3">
            <Phone size={14} className="flex-none" /> —
          </div>
        )}
        {contact.email ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Mail size={14} className="flex-none text-ink-3" />
            <span className="min-w-0 truncate select-all">{contact.email}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SupplierDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => supplierService.get(id), [id]);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;
  const { supplier, stats, products, purchases } = data;
  const archived = supplier.status === 'ARCHIVED';
  const contacts = supplier.contacts || [];

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
      <PageHeader crumbs={[['Suppliers', '/admin/suppliers'], [supplier.name]]} />

      <Card className="relative overflow-hidden p-0">
        <span className="blob -top-24 -right-16 size-72 opacity-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className={cn('grid size-[88px] flex-none place-items-center rounded-[24px] text-[28px] font-bold shadow-[inset_0_0_0_1px_var(--line),0_12px_26px_-16px_var(--brand-2)]', toneFor(supplier.name))}>
            {initials(supplier.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold tracking-[-0.02em] sm:text-[27px]">{supplier.name}</h1>
              {archived ? <Badge tone="bad">Deleted</Badge> : <Badge tone="ok">Active</Badge>}
            </div>
            <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-ink-3">
              <CalendarClock size={14} />
              Supplier since {fmtDate(supplier.createdAt)}
            </p>
          </div>
          <div className="relative flex flex-wrap gap-2 sm:justify-end">
            {archived ? (
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
            )}
          </div>
        </div>
      </Card>

      <StatBar
        items={[
          { key: 'spent', label: 'Total purchases', value: money(stats.totalPurchases), icon: Wallet, iconTone: 'ok', footer: 'across all restocks' },
          { key: 'restocks', label: 'Restocks', value: num(stats.purchaseCount), icon: ShoppingCart, iconTone: 'profit', footer: 'deliveries recorded' },
          { key: 'products', label: 'Products supplied', value: num(stats.productCount), icon: Layers, iconTone: 'info', footer: 'linked to this supplier' },
          { key: 'last', label: 'Last restock', value: stats.lastPurchaseAt ? fmtDate(stats.lastPurchaseAt) : '—', icon: CalendarClock, iconTone: 'warn', footer: stats.lastPurchaseAt ? 'most recent delivery' : 'no restocks yet' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="flex flex-col gap-4 self-start">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2.5">
                  <span className="tile tile-brand size-8 rounded-[10px]">
                    <User size={16} />
                  </span>
                  Contact information
                </span>
              }
              action={
                <Button size="sm" icon={Pencil} onClick={() => setModal('edit')}>
                  Edit
                </Button>
              }
            />
            {contacts.length ? (
              <div className="grid gap-3">
                {contacts.map((c, i) => (
                  <ContactTile key={i} contact={c} label={i === 0 ? 'Primary contact' : `Contact ${i + 1}`} />
                ))}
              </div>
            ) : (
              <p className="hint">No contact added yet.</p>
            )}
            {supplier.address && (
              <div className="mt-3 flex items-start gap-3 rounded-[16px] border border-line-2 bg-surface-2/60 p-4 text-[13.5px]">
                <span className="grid size-9 flex-none place-items-center rounded-[11px] bg-surface text-brand shadow-[inset_0_0_0_1px_var(--line)]">
                  <MapPin size={16} />
                </span>
                <span className="min-w-0 pt-1.5 break-words select-all">{supplier.address}</span>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2.5">
                  <span className="tile tile-info size-8 rounded-[10px]">
                    <Package size={16} />
                  </span>
                  Products supplied
                </span>
              }
              action={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-3">{plural(products.length, 'product')}</span>}
            />
            {products.length ? (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <Link key={p.id} to={`/admin/products/${p.id}`} className="card-lift group flex items-center gap-3 rounded-[16px] border border-line-2 bg-surface p-3">
                    <span className="grid size-12 flex-none place-items-center rounded-[13px]" style={{ background: `color-mix(in srgb, ${p.color || '#059669'} 14%, var(--surface-2))` }}>
                      <ProductThumb product={p} size={38} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{p.name}</b>
                      <small className="text-[12.5px] text-ink-3">{p.category}</small>
                    </div>
                    <span className="grid size-8 place-items-center rounded-full border border-line text-ink-3 transition-colors group-hover:border-brand/40 group-hover:text-brand-ink">
                      <ChevronRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="hint">No products link to this supplier yet. Set the main supplier when editing a product.</p>
            )}
          </Card>
        </div>

        <Card flush className="overflow-hidden">
          <CardHeader
            flush
            title={
              <span className="flex items-center gap-2.5">
                <span className="tile tile-brand size-8 rounded-[10px]">
                  <Clock size={16} />
                </span>
                Restock history
              </span>
            }
            action={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-3">{plural(purchases.length, 'restock')}</span>}
          />
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
                      <td>
                        <span className="tnum rounded-[8px] bg-surface-2 px-2 py-1 text-[12.5px] font-semibold">{p.purchaseNumber}</span>
                      </td>
                      <td className="text-ink-3">{fmtDate(p.createdAt)}</td>
                      <td className="!whitespace-normal">
                        {p.items.map((i) => (
                          <div key={i.variantId} className="text-[13px]">
                            {plural(i.quantity, i.unit)} <span className="text-ink-2">{i.name}</span>
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
            <EmptyState icon={Truck} title="No restocks yet" text="Restocks from this supplier will be listed here, with what came in and what it cost." action={<Button variant="primary" icon={Truck} onClick={() => setModal('restock')}>Restock from supplier</Button>} />
          )}
        </Card>
      </div>

      <SupplierModal open={modal === 'edit'} onClose={() => setModal(null)} supplier={supplier} onDone={reload} />
      <RestockModal open={modal === 'restock'} onClose={() => setModal(null)} supplierId={id} onDone={reload} />
      <DeleteSupplierModal open={modal === 'delete'} onClose={() => setModal(null)} supplier={supplier} onDone={reload} />
    </Page>
  );
}
