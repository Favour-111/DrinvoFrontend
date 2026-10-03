import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ban, Check, PackageSearch, Plus, ShoppingCart } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, MiniStat } from '../../components/ui/Card.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { RequestOnDemandModal, MarkPurchasedModal } from '../../components/modals/OnDemandModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { inventoryService, onDemandPurchaseService } from '../../services/index.js';
import { money, plural, shortDateTime } from '../../utils/format.js';
import { UNIT_LABEL } from '../../utils/units.js';

const STATUS_TONE = { PENDING: 'warn', PURCHASED: 'info', PARTIALLY_SOLD: 'info', SOLD: 'ok', CANCELLED: 'neutral' };
const STATUS_LABEL = { PENDING: 'Pending', PURCHASED: 'Purchased — not sold yet', PARTIALLY_SOLD: 'Partially sold', SOLD: 'Sold', CANCELLED: 'Cancelled' };

/**
 * Buying something this shop doesn't normally stock, specifically to fulfil one customer's
 * request — distinct from a Stock Transfer (that's between our own shops), a Borrowing (that's a
 * loan, never a buy) and a normal Sale (that's revenue, not a purchase). Shared between the staff
 * and admin routes; only staff can hand a purchase straight into a sale, since only staff can run
 * checkout at all.
 */
export default function OnDemandPurchases() {
  const navigate = useNavigate();
  const isStaff = useLocation().pathname.startsWith('/staff');
  const toast = useToast();
  const cart = useCart();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [sellingId, setSellingId] = useState(null);
  const { data, error, loading, reload } = useApi(() => onDemandPurchaseService.list({ status, page, limit: 30 }), [status, page]);

  const set = (fn) => (v) => {
    setPage(1);
    fn(v);
  };

  const sellNow = async (odp) => {
    setSellingId(odp.id);
    try {
      const { item } = await inventoryService.get(odp.variantId);
      const pricePerBottle = odp.sellingPricePerUnit ? odp.sellingPricePerUnit / (odp.conversion || 1) : undefined;
      cart.addLine(item, { unit: 'bottle', quantity: odp.remainingBaseQuantity, priceOverride: pricePerBottle });
      navigate('/staff/sale');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSellingId(null);
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const pending = data.items.filter((o) => o.status === 'PENDING').length;
  const awaitingSale = data.items.filter((o) => o.status === 'PURCHASED' || o.status === 'PARTIALLY_SOLD').length;
  const sold = data.items.filter((o) => o.status === 'SOLD').length;

  return (
    <Page className={isStaff ? 'pb-24 md:pb-6' : undefined}>
      <PageHeader
        title="On-Demand Purchases"
        subtitle="Buy something this shop doesn't stock, just to fulfil a customer's request."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setRequesting(true)}>
            New Request
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Records" value={data.total} />
        <MiniStat label="Pending" value={pending} tone={pending ? 'warn' : undefined} />
        <MiniStat label="Awaiting sale" value={awaitingSale} tone={awaitingSale ? 'info' : undefined} />
        <MiniStat label="Sold" value={sold} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select aria-label="Status" value={status} onChange={(e) => set(setStatus)(e.target.value)} className="w-auto min-w-[200px]">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PURCHASED">Purchased — not sold yet</option>
          <option value="PARTIALLY_SOLD">Partially sold</option>
          <option value="SOLD">Sold</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <Card flush>
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[920px]">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Bought from</th>
                    <th className="num">Cost</th>
                    <th className="num">Remaining</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td className="tnum font-semibold">{o.odpNumber}</td>
                      <td>{o.name}</td>
                      <td className="text-ink-3">{o.customerName || '—'}</td>
                      <td className="text-ink-3">{o.purchasedFrom}</td>
                      <td className="num tnum">{o.totalCost ? money(o.totalCost) : '—'}</td>
                      <td className="num tnum">{o.status === 'PENDING' || o.status === 'CANCELLED' ? '—' : plural(o.remainingBaseQuantity, 'bottle')}</td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                      </td>
                      <td className="text-ink-3">{shortDateTime(o.createdAt)}</td>
                      <td className="num">
                        <div className="flex justify-end gap-1.5">
                          {o.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="primary" icon={Check} onClick={() => setPurchasing(o)}>
                                Mark Purchased
                              </Button>
                              <IconButton size={30} icon={Ban} label={`Cancel ${o.odpNumber}`} onClick={() => setCancelling(o)} />
                            </>
                          )}
                          {(o.status === 'PURCHASED' || o.status === 'PARTIALLY_SOLD') && (
                            <>
                              {isStaff && (
                                <Button size="sm" variant="primary" icon={ShoppingCart} loading={sellingId === o.id} onClick={() => sellNow(o)}>
                                  Sell Now
                                </Button>
                              )}
                              <IconButton size={30} icon={Ban} label={`Cancel ${o.odpNumber}`} onClick={() => setCancelling(o)} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-[13px] text-ink-3">
                <span>
                  Page {data.page} of {data.pages} · {data.total} records
                </span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="No on-demand purchases yet"
            text="When a customer wants something you don't stock, record it here."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setRequesting(true)}>
                New Request
              </Button>
            }
          />
        )}
      </Card>

      <RequestOnDemandModal open={requesting} onClose={() => setRequesting(false)} onDone={reload} />
      <MarkPurchasedModal open={Boolean(purchasing)} onClose={() => setPurchasing(null)} onDone={reload} odp={purchasing} canSell={isStaff} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          await onDemandPurchaseService.cancel(cancelling.id, {});
          toast.success('Cancelled.');
          reload();
        }}
        title={`Cancel ${cancelling?.odpNumber}?`}
        confirmLabel="Cancel Purchase"
        icon={Ban}
      >
        {cancelling?.remainingBaseQuantity > 0
          ? `This removes the remaining ${plural(cancelling.remainingBaseQuantity, 'bottle')} from stock. Anything already sold stays sold.`
          : 'This request will be marked cancelled.'}
      </ConfirmDialog>
    </Page>
  );
}
