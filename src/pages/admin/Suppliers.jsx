import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Truck } from '../../components/icons.js';
import { Page, PageHeader, Tabs } from '../../components/ui/Nav.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, Tag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { SupplierModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { supplierService } from '../../services/index.js';
import { initials, money, plural, timeAgo } from '../../utils/format.js';

export default function Suppliers() {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const { data, error, reload } = useApi(() => supplierService.list({ status }), [status]);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;
  const total = data.reduce((s, x) => s + x.totalPurchases, 0);
  const archivedView = status === 'ARCHIVED';

  return (
    <Page>
      <PageHeader
        title="Suppliers"
        subtitle={archivedView ? `${plural(data.length, 'deleted supplier')}` : `${plural(data.length, 'supplier')} · ${money(total)} purchased`}
        actions={
          !archivedView && (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              Add Supplier
            </Button>
          )
        }
      />
      <Tabs
        label="Supplier status"
        value={status}
        onChange={setStatus}
        options={[
          ['ACTIVE', 'Active'],
          ['ARCHIVED', 'Deleted'],
        ]}
      />
      {data.length ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
          {data.map((s) => (
            <Link key={s.id} to={`/admin/suppliers/${s.id}`} className="card flex flex-col gap-3.5 p-5 transition-colors hover:border-brand/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-surface-3 text-[15px] font-bold">{initials(s.name)}</span>
                <div className="min-w-0 flex-1">
                  <b className="flex items-center gap-1.5 truncate text-[15px]">
                    <span className="truncate">{s.name}</span>
                    {archivedView && <Badge tone="bad">Deleted</Badge>}
                  </b>
                  <small className="text-ink-3">
                    {[s.contacts?.[0]?.name, s.contacts?.[0]?.phone].filter(Boolean).join(' · ')}
                    {s.contacts?.length > 1 && ` · +${s.contacts.length - 1} more`}
                  </small>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.products.length ? s.products.map((p) => <Tag key={p.id}>{p.name}</Tag>) : <span className="hint">No products linked yet</span>}
              </div>
              <div className="mt-auto flex justify-between border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                <div>
                  Purchases<b className="tnum block text-[14px] text-ink">{money(s.totalPurchases)}</b>
                </div>
                <div>
                  Restocks<b className="tnum block text-[14px] text-ink">{s.purchaseCount}</b>
                </div>
                <div>
                  Last restock<b className="block text-[14px] text-ink">{s.lastPurchaseAt ? timeAgo(s.lastPurchaseAt) : '—'}</b>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : archivedView ? (
        <div className="card">
          <EmptyState icon={Truck} title="No deleted suppliers" text="Suppliers you delete show up here, and can be restored." />
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={Truck} title="No suppliers" text="Add suppliers to keep track of your stock sources." action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add Supplier</Button>} />
        </div>
      )}
      <SupplierModal open={adding} onClose={() => setAdding(false)} onDone={reload} />
    </Page>
  );
}
