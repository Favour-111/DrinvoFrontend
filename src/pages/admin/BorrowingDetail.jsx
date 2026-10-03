import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Phone, Undo2 } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton, EmptyState } from '../../components/ui/Feedback.jsx';
import { ReturnBorrowingModal } from '../../components/modals/BorrowModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { borrowingService } from '../../services/index.js';
import { fmtDate, fmtDateTime, plural } from '../../utils/format.js';
import { UNIT_LABEL } from '../../utils/units.js';

const STATUS_TONE = { OUTSTANDING: 'warn', PARTIALLY_RETURNED: 'info', RETURNED: 'ok' };
const STATUS_LABEL = { OUTSTANDING: 'Outstanding', PARTIALLY_RETURNED: 'Partially returned', RETURNED: 'Returned' };
const unitsText = (counts) => counts.map((c) => `${c.quantity} ${UNIT_LABEL[c.unit]}${c.quantity === 1 ? '' : 's'}`).join(' + ');

export default function BorrowingDetail() {
  const { id } = useParams();
  const [returning, setReturning] = useState(false);
  const { data, error, reload } = useApi(() => borrowingService.get(id), [id]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const lent = data.direction === 'LENT';

  return (
    <Page>
      <PageHeader
        crumbs={[['Borrowed Drinks', '/admin/borrowings'], [data.borrowNumber]]}
        title={data.borrowNumber}
        subtitle={`${lent ? 'Lent to' : 'Borrowed from'} ${data.counterpartyName} · ${fmtDateTime(data.createdAt)}`}
        actions={
          data.status !== 'RETURNED' && (
            <Button variant="primary" icon={Undo2} onClick={() => setReturning(true)}>
              Record Return
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${lent ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info'}`}>
          {lent ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
          {lent ? 'Borrowed out — owed to us' : 'Borrowed in — we owe this'}
        </span>
        <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
        {data.overdue && <Badge tone="bad">Overdue</Badge>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="self-start">
          <h3 className="mb-3.5 text-[16px] font-semibold">Details</h3>
          <DetailList
            rows={[
              [lent ? 'Borrowed by' : 'Borrowed from', data.counterpartyName, true],
              data.counterpartyPhone && [
                'Phone',
                <span className="flex items-center gap-1.5" key="phone">
                  <Phone size={13} className="text-ink-3" /> {data.counterpartyPhone}
                </span>,
              ],
              ['Date', fmtDate(data.createdAt)],
              ['Expected return', data.expectedReturnDate ? fmtDate(data.expectedReturnDate) : 'Not set'],
              ['Recorded by', data.createdBy?.name || '—'],
              ['Total borrowed', plural(data.totalBorrowed, 'bottle'), true],
              ['Total returned', plural(data.totalReturned, 'bottle')],
              ['Remaining', plural(data.totalRemaining, 'bottle'), true],
            ]}
          />
          {data.notes && (
            <>
              <div className="mt-4 mb-1 label">Notes</div>
              <p className="text-[13.5px] text-ink-2">{data.notes}</p>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card flush>
            <CardHeader flush title="Products" />
            <div className="overflow-x-auto">
              <table className="table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Borrowed as</th>
                    <th className="num">Borrowed</th>
                    <th className="num">Returned</th>
                    <th className="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.variantId}>
                      <td className="font-semibold">{i.name}</td>
                      <td className="text-ink-2">{unitsText(i.countedUnits)}</td>
                      <td className="num tnum">{plural(i.baseQuantity, 'bottle')}</td>
                      <td className="num tnum">{plural(i.returnedBaseQuantity, 'bottle')}</td>
                      <td className={`num tnum font-semibold ${i.remainingBaseQuantity > 0 ? 'text-warn' : 'text-ok'}`}>{plural(i.remainingBaseQuantity, 'bottle')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card flush>
            <CardHeader flush title="Return History" />
            {data.returns.length ? (
              <div className="flex flex-col">
                {data.returns.map((r, idx) => (
                  <div key={idx} className="border-b border-line-2 px-5 py-3 last:border-0">
                    <div className="flex items-center justify-between text-[13px]">
                      <b className="font-semibold">{r.by?.name || 'Unknown'}</b>
                      <span className="text-ink-3">{fmtDateTime(r.date)}</span>
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {r.items.map((i) => (
                        <div key={i.variantId} className="text-[13px] text-ink-2">
                          {i.name} — {unitsText(i.countedUnits)}
                        </div>
                      ))}
                    </div>
                    {r.notes && <p className="mt-1 text-[12.5px] text-ink-3">{r.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Undo2} title="Nothing returned yet" text="Returns recorded against this borrowing will show up here." />
            )}
          </Card>
        </div>
      </div>

      <ReturnBorrowingModal open={returning} onClose={() => setReturning(false)} onDone={reload} borrowing={data} />
    </Page>
  );
}
