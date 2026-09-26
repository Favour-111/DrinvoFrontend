import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Check, Plus, Receipt as ReceiptIcon } from '../../components/icons.js';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card, DetailList } from '../../components/ui/Card.jsx';
import { PaymentTag } from '../../components/ui/Badge.jsx';
import { SyncStatusTag } from '../../components/SyncStatusTag.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Receipt, ReceiptActions } from '../../components/Receipt.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getLocalSale } from '../../offline/localSales.js';
import { subscribeSync } from '../../offline/syncManager.js';
import { salesService } from '../../services/index.js';
import { fmtTime, money, PAYMENT_LABEL, plural } from '../../utils/format.js';

export default function SaleComplete() {
  const { id } = useParams();
  const { shop } = useAuth();
  const location = useLocation();
  const [showReceipt, setShowReceipt] = useState(false);
  const passed = location.state?.sale;
  const isLocal = id.startsWith('LOCAL-');
  const [data, setData] = useState(passed?.id === id ? passed : null);
  const [error, setError] = useState(null);

  // If we didn't arrive via navigation (e.g. the page was refreshed), reload from wherever
  // this sale actually lives — IndexedDB for a not-yet-synced local sale, the API otherwise.
  useEffect(() => {
    if (passed?.id === id) return;
    if (isLocal) {
      if (!shop?.id) return;
      getLocalSale(shop.id, id).then((s) => (s ? setData(s) : setError(new Error('That sale isn’t on this device.'))));
    } else {
      salesService.get(id).then(setData).catch(setError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shop?.id, isLocal]);

  // A local sale's status/receipt number changes as the background sync progresses — reflect that live.
  useEffect(() => {
    if (!isLocal || !shop?.id) return undefined;
    return subscribeSync(shop.id, () => {
      getLocalSale(shop.id, id).then((s) => s && setData(s));
    });
  }, [isLocal, shop?.id, id]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;
  const s = data;

  return (
    <div className="animate-rise mx-auto mt-2.5 flex max-w-[520px] flex-col gap-4 text-center">
      <div className="animate-pop mx-auto grid size-[76px] place-items-center rounded-full bg-brand text-white shadow-[0_0_0_12px_var(--brand-soft)]">
        <Check size={38} />
      </div>
      <div>
        <h1 className="text-[26px] font-bold">Sale Completed</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">
          Receipt {s.receiptNumber} · {fmtTime(s.createdAt)}
        </p>
        {s.syncStatus && (
          <div className="mt-2 flex justify-center">
            <SyncStatusTag status={s.syncStatus} />
          </div>
        )}
        {s.syncStatus === 'PENDING' && <p className="mt-1.5 text-[12.5px] text-ink-3">Saved on this device. It’ll sync automatically once you’re back online.</p>}
        {s.syncStatus === 'FAILED' && <p className="mt-1.5 text-[12.5px] text-bad">{s.error || 'This sale needs attention — see Sales history.'}</p>}
      </div>
      <Card className="text-left">
        {s.items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <b className="block font-semibold">{i.variantName}</b>
              <small className="text-[12.5px] text-ink-3">
                {plural(i.quantity, i.unit)} × {money(i.unitPrice)}
                {i.listPrice > i.unitPrice && <span className="text-warn"> (was {money(i.listPrice)})</span>}
              </small>
            </div>
            <b className="tnum">{money(i.lineTotal)}</b>
          </div>
        ))}
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-medium text-ink-2">Total</span>
          <b className="tnum text-[26px] font-bold">{money(s.total)}</b>
        </div>
        <div className="mt-3">
          <DetailList
            rows={[
              s.totalDiscount > 0 && ['Discount given', <span key="d" className="font-semibold text-warn">{`−${money(s.totalDiscount)}`}</span>],
              ['Payment', <PaymentTag key="p" method={s.paymentMethod} />],
              s.paymentMethod === 'PART' && [`Paid now (${PAYMENT_LABEL[s.paidWith]})`, money(s.amountPaid)],
              s.balanceAtSale > 0 && ['Balance owed', <span key="b" className="font-semibold text-warn">{money(s.balanceAtSale)}</span>],
              s.customer && ['Customer', s.customer.name],
              ['Served by', s.staff?.name],
            ]}
          />
        </div>
      </Card>
      <Button icon={ReceiptIcon} onClick={() => setShowReceipt(true)}>
        View Receipt
      </Button>
      <ReceiptActions sale={s} />
      <ButtonLink to="/staff/sale" variant="primary" size="lg" icon={Plus}>
        Start new sale
      </ButtonLink>
      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="Receipt" size="sm">
        <div className="pb-3">
          <Receipt sale={s} />
        </div>
        <ReceiptActions sale={s} size="sm" />
      </Modal>
    </div>
  );
}
