import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, MapPin, Pencil, Phone, Receipt, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PaymentTag, SaleStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { CustomerModal, PaymentModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { customerService } from '../../services/index.js';
import { fmtDate, initials, money, num, PAYMENT_LABEL, shortDateTime } from '../../utils/format.js';

const LEDGER_LABEL = {
  CREDIT_SALE: ['Credit sale', 'bg-warn-soft text-warn'],
  PAYMENT: ['Payment', 'bg-ok-soft text-ok'],
  RETURN_CREDIT: ['Return credit', 'bg-surface-3 text-ink-2'],
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => customerService.get(id), [id]);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={3} />;
  const { customer: c, ledger, sales } = data;
  const hasCredit = c.totalCredit > 0;

  return (
    <Page>
      <PageHeader
        crumbs={[['Customers', '/admin/customers'], [c.name]]}
        subtitle={c.businessName}
        actions={
          <>
            <Button icon={Pencil} onClick={() => setModal('edit')}>
              Edit
            </Button>
            {c.outstanding > 0 && (
              <Button variant="primary" icon={Wallet} onClick={() => setModal('pay')}>
                Record Payment
              </Button>
            )}
          </>
        }
      >
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-[18px] font-bold">{initials(c.name)}</span>
          <div>
            <h1 className="text-[22px] font-bold sm:text-[24px]">{c.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-3">
              <span className="tnum inline-flex items-center gap-1.5 select-all">
                <Phone size={14} />
                {c.phone}
              </span>
              {c.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {c.address}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                Customer since {fmtDate(c.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Purchases" value={num(c.purchaseCount)} />
        <MiniStat label="Total spent" value={money(c.totalSpent)} />
        <MiniStat label="Owes on credit" value={money(c.outstanding)} tone={c.outstanding > 0 ? 'warn' : undefined} />
        <MiniStat label="Last purchase" value={c.lastPurchaseAt ? fmtDate(c.lastPurchaseAt) : '—'} />
      </div>

      <Card flush>
        <CardHeader flush title="Purchases" action={<span className="hint">{num(sales.length)} sales</span>} />
        {sales.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th className="num">Amount</th>
                  <th>Payment</th>
                  <th>Sold by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="row-link" onClick={() => navigate(`/admin/sales/${s.id}`)}>
                    <td>
                      <b className="tnum block font-semibold">{s.receiptNumber}</b>
                      {s.status !== 'COMPLETED' && <SaleStatusBadge status={s.status} />}
                    </td>
                    <td className="num font-semibold">{money(s.netTotal)}</td>
                    <td>
                      <PaymentTag method={s.paymentMethod} />
                    </td>
                    <td>{s.staff?.split(' ')[0]}</td>
                    <td className="text-ink-3">{shortDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No purchases yet" text="Sales to this customer will be listed here." />
        )}
      </Card>

      {hasCredit && (
        <Card flush>
          <CardHeader
            flush
            title="Credit history"
            action={
              <span className="hint">
                {money(c.totalPaid)} paid of {money(c.totalCredit)}
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => {
                  const [label, tone] = l.paymentMethod === 'PART' ? ['Part-paid sale', LEDGER_LABEL.CREDIT_SALE[1]] : LEDGER_LABEL[l.type] || [l.type, 'bg-surface-3 text-ink-2'];
                  return (
                    <tr key={l.type + l.id}>
                      <td>
                        <span className={`inline-flex h-6 items-center rounded-[7px] px-2.5 text-[11px] font-bold tracking-wider uppercase ${tone}`}>{label}</span>
                      </td>
                      <td>
                        {l.type === 'CREDIT_SALE' ? (
                          <Link className="font-semibold text-brand hover:underline" to={`/admin/sales/${l.saleId}`}>
                            {l.reference}
                          </Link>
                        ) : (
                          <span>
                            {PAYMENT_LABEL[l.method]}
                            {l.reference ? <span className="text-ink-3"> · {l.reference}</span> : ''}
                          </span>
                        )}
                        {l.status === 'VOIDED' && <span className="text-ink-3"> · voided</span>}
                      </td>
                      <td className="text-ink-3">{fmtDate(l.date)}</td>
                      <td className={`num font-semibold ${l.type === 'CREDIT_SALE' ? '' : 'text-ok'}`}>
                        {l.type === 'CREDIT_SALE' ? '' : '−'}
                        {money(l.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PaymentModal open={modal === 'pay'} onClose={() => setModal(null)} customer={c} onDone={reload} />
      <CustomerModal open={modal === 'edit'} onClose={() => setModal(null)} customer={c} onDone={reload} />
    </Page>
  );
}
