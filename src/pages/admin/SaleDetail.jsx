import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, Package, Percent, Receipt as ReceiptIcon, ShoppingBag, Undo2, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, PaymentTag, SaleStatusBadge } from '../../components/ui/Badge.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Receipt, ReceiptActions } from '../../components/Receipt.jsx';
import { RefundModal, ReturnModal, VoidModal } from '../../components/modals/SaleModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { salesService } from '../../services/index.js';
import { fmtDateTime, money, num, PAYMENT_LABEL, plural, shortDateTime } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

export default function SaleDetail() {
  const { id } = useParams();
  const [modal, setModal] = useState(null);
  const { data: s, error, reload } = useApi(() => salesService.get(id), [id]);

  if (error && !s) return <ErrorState error={error} onRetry={reload} />;
  if (!s) return <PageSkeleton stats={0} />;
  const canReturn = s.status !== 'VOIDED' && s.status !== 'RETURNED';
  const canVoid = s.status === 'COMPLETED' && !s.returnedAmount && !s.refundedAmount;

  return (
    <Page>
      <PageHeader
        crumbs={[['Sales', '/admin/sales'], [s.receiptNumber]]}
        subtitle={`${fmtDateTime(s.createdAt)} · served by ${s.staff?.name}`}
        actions={
          canReturn && (
            <>
              <Button icon={Undo2} onClick={() => setModal('return')}>
                Process return
              </Button>
              <Button icon={Wallet} onClick={() => setModal('refund')} disabled={s.netTotal <= 0}>
                Refund
              </Button>
              {canVoid && (
                <Button variant="danger-soft" icon={Ban} onClick={() => setModal('void')}>
                  Void
                </Button>
              )}
            </>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tnum text-[22px] font-bold sm:text-[24px]">{s.receiptNumber}</h1>
          <SaleStatusBadge status={s.status} />
        </div>
      </PageHeader>

      {s.status === 'VOIDED' && (
        <div className="flex gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px] text-ink-2">
          <Ban size={16} className="mt-px flex-none text-ink-3" />
          <span>
            This sale was voided{s.voidReason ? `: ${s.voidReason}` : ''}. Stock was returned and it no longer counts toward revenue. The record stays for the audit trail.
          </span>
        </div>
      )}

      {(() => {
        const units = s.items.reduce((n, i) => n + i.baseQuantity, 0);
        const margin = s.netTotal > 0 ? (s.profit / s.netTotal) * 100 : 0;
        return (
          <StatBar
            items={[
              { key: 'items', label: 'Bottles sold', value: num(units), icon: ShoppingBag, iconTone: 'info', footer: plural(s.items.length, 'line') },
              { key: 'total', label: 'Total amount', value: money(s.netTotal), icon: Wallet, iconTone: 'brand', footer: s.netTotal !== s.total ? `was ${money(s.total)} before returns` : 'paid in full at the till' },
              { key: 'cost', label: 'Cost', value: money(s.netCost), icon: Package, iconTone: 'neutral', footer: 'weighted average at sale time' },
              { key: 'margin', label: 'Profit', value: money(s.profit), icon: Percent, iconTone: 'ok', footer: <span className={cn('rounded-full px-2 py-0.5 font-semibold', s.profit >= 0 ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>{margin.toFixed(1)}% margin</span> },
            ]}
          />
        );
      })()}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Card flush>
            <CardHeader flush title={<span className="flex items-center gap-2.5"><span className="tile tile-brand size-8 rounded-[10px]"><ShoppingBag size={16} /></span>Products</span>} action={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-3">{plural(s.items.length, 'line')}</span>} />
            <div className="overflow-x-auto">
              <table className="table min-w-[600px]">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th className="num">Price</th>
                    <th className="num">Total</th>
                    <th className="num">Cost</th>
                    <th>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <ProductThumb product={{ name: i.variantName }} size={38} />
                          <span className="min-w-0">
                            <Link to={`/admin/inventory/${i.variantId}`} className="font-semibold hover:text-brand-ink hover:underline">
                              {i.variantName}
                            </Link>
                            <small className="block text-[12px] text-ink-3">{plural(i.baseQuantity, 'bottle')} in total</small>
                          </span>
                        </span>
                      </td>
                      <td>{plural(i.quantity, i.unit)}</td>
                      <td className="num">
                        {i.listPrice > i.unitPrice && <span className="mr-1.5 text-ink-3 line-through">{money(i.listPrice)}</span>}
                        {money(i.unitPrice)}
                      </td>
                      <td className="num font-semibold">{money(i.lineTotal)}</td>
                      <td className="num text-ink-3">{money(i.lineCost)}</td>
                      <td>{i.returnedQuantity ? <Badge tone="warn">{i.returnedQuantity} returned</Badge> : <span className="text-ink-3">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2.5"><span className="tile tile-ok size-8 rounded-[10px]"><Percent size={16} /></span>Summary</span>} />
              <DetailList
                rows={[
                  s.totalDiscount > 0 && ['Discount given', <span key="d" className="font-semibold text-warn">{`−${money(s.totalDiscount)}`}</span>],
                  ['Total', money(s.total)],
                  s.returnedAmount > 0 && ['Returns', `−${money(s.returnedAmount)}`],
                  s.refundedAmount > 0 && ['Refunds', `−${money(s.refundedAmount)}`],
                  ['Net revenue', money(s.netTotal), true],
                  ['Cost', money(s.netCost)],
                  ['Profit', <span key="p" className="font-bold text-ok">{money(s.profit)}</span>],
                ]}
              />
            </Card>
            <Card>
              <CardHeader title={<span className="flex items-center gap-2.5"><span className="tile tile-info size-8 rounded-[10px]"><Wallet size={16} /></span>Details</span>} />
              <DetailList
                rows={[
                  [
                    'Customer',
                    s.customer ? (
                      <Link key="c" className="font-semibold text-brand" to={`/admin/customers/${s.customer.id}`}>
                        {s.customer.name}
                        <small className="tnum block font-normal text-ink-3">{s.customer.phone}</small>
                      </Link>
                    ) : (
                      'Walk-in'
                    ),
                  ],
                  ['Payment', <PaymentTag key="pm" method={s.paymentMethod} />],
                  s.paymentMethod === 'PART' && [`Paid now (${PAYMENT_LABEL[s.paidWith]})`, money(s.amountPaid)],
                  s.balanceAtSale > 0 && ['Put on credit', <span key="bal" className="font-semibold text-warn">{money(s.balanceAtSale)}</span>],
                  ['Status', <SaleStatusBadge key="st" status={s.status} />],
                  ['Sold by', s.staff?.name],
                ]}
              />
            </Card>
          </div>

          {(s.returns.length > 0 || s.refunds.length > 0) && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2.5"><span className="tile tile-warn size-8 rounded-[10px]"><Undo2 size={16} /></span>Returns &amp; refunds</span>} />
              <p className="hint mb-2">Linked to this sale. The original sale above is unchanged.</p>
              {s.returns.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
                  <span className="size-2 flex-none rounded-full bg-warn" />
                  <div className="min-w-0 flex-1">
                    <b className="font-semibold">{r.returnNumber} · Return</b>
                    <small className="block text-[12.5px] text-ink-3">
                      {r.items.map((x) => `${x.quantity} × ${x.variantName}`).join(', ')} · {r.reason} · {r.restocked ? 'back in stock' : 'not restocked'} · by {r.processedBy}, {shortDateTime(r.createdAt)}
                    </small>
                  </div>
                  <div className="text-right">
                    <b className="tnum block text-bad">−{money(r.totalAmount)}</b>
                    <small className="text-[12px] text-ink-3">{PAYMENT_LABEL[r.refundMethod]}</small>
                  </div>
                </div>
              ))}
              {s.refunds
                .filter((r) => !r.returnId)
                .map((r) => (
                  <div key={r.id} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
                    <span className="size-2 flex-none rounded-full bg-info" />
                    <div className="min-w-0 flex-1">
                      <b className="font-semibold">{r.refundNumber} · Refund</b>
                      <small className="block text-[12.5px] text-ink-3">
                        {r.reason} · by {r.processedBy}, {shortDateTime(r.createdAt)}
                      </small>
                    </div>
                    <div className="text-right">
                      <b className="tnum block text-bad">−{money(r.amount)}</b>
                      <small className="text-[12px] text-ink-3">{PAYMENT_LABEL[r.method]}</small>
                    </div>
                  </div>
                ))}
            </Card>
          )}
        </div>

        <aside className="relative flex flex-col gap-3 overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card xl:sticky xl:top-[84px] xl:self-start">
          <span className="blob -top-16 -right-16 size-48 opacity-50" aria-hidden="true" />
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-[16px] font-semibold">
              <span className="tile tile-brand size-8 rounded-[10px]"><ReceiptIcon size={16} /></span>
              Receipt
            </span>
          </div>
          <div className="relative rounded-[14px] bg-surface-2/70 px-3 py-5">
            <Receipt sale={s} />
          </div>
          <ReceiptActions sale={s} className="relative" />
        </aside>
      </div>

      <ReturnModal open={modal === 'return'} onClose={() => setModal(null)} sale={s} onDone={reload} />
      <RefundModal open={modal === 'refund'} onClose={() => setModal(null)} sale={s} onDone={reload} />
      <VoidModal open={modal === 'void'} onClose={() => setModal(null)} sale={s} onDone={reload} />
    </Page>
  );
}
