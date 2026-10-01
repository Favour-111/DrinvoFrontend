import { useMemo, useState } from 'react';
import { ArrowLeftRight, Search } from '../../components/icons.js';
import { Page, Tabs } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StockBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { TransferModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { inventoryService } from '../../services/index.js';
import { money } from '../../utils/format.js';
import { describeStock } from '../../utils/units.js';

/** Stock view for staff: read-only for levels (the API strips cost fields for this role), but
 * staff can record a transfer to move stock between shops. */
export default function StaffInventory() {
  const { shops } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [transferring, setTransferring] = useState(false);
  const { data, error, reload } = useApi(() => inventoryService.list(), []);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items || []).filter((i) => (status === 'all' || i.status === status) && (!needle || i.name.toLowerCase().includes(needle)));
  }, [data, q, status]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">Inventory</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">What’s available to sell right now.</p>
        </div>
        {shops.length > 1 && (
          <Button icon={ArrowLeftRight} onClick={() => setTransferring(true)}>
            Transfer Stock
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full sm:max-w-[360px] sm:flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks" aria-label="Search drinks" />
        </label>
        <Tabs
          label="Stock status"
          value={status}
          onChange={setStatus}
          options={[
            ['all', 'All'],
            ['in', 'Available'],
            ['low', 'Low'],
            ['out', 'Out'],
          ]}
        />
      </div>
      <Card className="py-1.5">
        {items.length ? (
          items.map((i) => (
            <div key={i.variantId} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
              <ProductThumb product={i} size={40} />
              <div className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{i.productName}</b>
                <small className="text-[12.5px] text-ink-3">
                  {i.size} · {money(i.sellingPrice)} per bottle
                </small>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <b className="tnum font-semibold">{i.status === 'out' ? '—' : describeStock(i)}</b>
                <StockBadge status={i.status} />
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={Search} title="No drinks found" text="Try another search." />
        )}
      </Card>
      <TransferModal open={transferring} onClose={() => setTransferring(false)} onDone={reload} />
    </Page>
  );
}
