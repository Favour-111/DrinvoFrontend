import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Plus, Undo2 } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { BorrowModal } from '../../components/modals/BorrowModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { borrowingService } from '../../services/index.js';
import { fmtDate, plural, shortDateTime } from '../../utils/format.js';

const STATUS_TONE = { OUTSTANDING: 'warn', PARTIALLY_RETURNED: 'info', RETURNED: 'ok' };
const STATUS_LABEL = { OUTSTANDING: 'Outstanding', PARTIALLY_RETURNED: 'Partially returned', RETURNED: 'Returned' };

export default function Borrowings() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi(() => borrowingService.list({ direction, status, page, limit: 30 }), [direction, status, page]);
  const overdueCount = useApi(() => borrowingService.list({ overdue: true, limit: 1 }), []);

  const set = (fn) => (v) => {
    setPage(1);
    fn(v);
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const outTotal = data.items.filter((b) => b.direction === 'LENT' && b.status !== 'RETURNED').reduce((s, b) => s + b.totalRemaining, 0);
  const inTotal = data.items.filter((b) => b.direction === 'BORROWED' && b.status !== 'RETURNED').reduce((s, b) => s + b.totalRemaining, 0);

  return (
    <Page>
      <PageHeader
        title="Borrowed Drinks"
        subtitle="Drinks lent to or borrowed from someone outside the business — never a sale."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Record Borrowing
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Records" value={data.total} />
        <MiniStat label="Owed to us (bottles)" value={outTotal} />
        <MiniStat label="We owe (bottles)" value={inTotal} />
        <MiniStat label="Overdue" value={overdueCount.data?.total ?? '—'} tone={overdueCount.data?.total ? 'bad' : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select aria-label="Direction" value={direction} onChange={(e) => set(setDirection)(e.target.value)} className="w-auto min-w-[170px]">
          <option value="">Borrowed out &amp; in</option>
          <option value="LENT">Borrowed out (owed to us)</option>
          <option value="BORROWED">Borrowed in (we owe)</option>
        </Select>
        <Select aria-label="Status" value={status} onChange={(e) => set(setStatus)(e.target.value)} className="w-auto min-w-[160px]">
          <option value="">All statuses</option>
          <option value="OUTSTANDING">Outstanding</option>
          <option value="PARTIALLY_RETURNED">Partially returned</option>
          <option value="RETURNED">Returned</option>
        </Select>
      </div>

      <Card flush>
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[900px]">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Direction</th>
                    <th>Shop/Person</th>
                    <th className="num">Borrowed</th>
                    <th className="num">Returned</th>
                    <th className="num">Remaining</th>
                    <th>Expected Return</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.items.map((b) => (
                    <tr key={b.id} className="row-link" onClick={() => navigate(`/admin/borrowings/${b.id}`)}>
                      <td className="tnum font-semibold">{b.borrowNumber}</td>
                      <td>
                        <span className={`flex items-center gap-1.5 text-[12.5px] font-medium ${b.direction === 'LENT' ? 'text-warn' : 'text-info'}`}>
                          {b.direction === 'LENT' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          {b.direction === 'LENT' ? 'Lent out' : 'Borrowed in'}
                        </span>
                      </td>
                      <td>{b.counterpartyName}</td>
                      <td className="num tnum">{plural(b.totalBorrowed, 'bottle')}</td>
                      <td className="num tnum">{plural(b.totalReturned, 'bottle')}</td>
                      <td className="num tnum font-semibold">{plural(b.totalRemaining, 'bottle')}</td>
                      <td className="text-ink-3">{b.expectedReturnDate ? fmtDate(b.expectedReturnDate) : '—'}</td>
                      <td>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                          {b.overdue && <Badge tone="bad">Overdue</Badge>}
                        </span>
                      </td>
                      <td className="text-ink-3">{shortDateTime(b.createdAt)}</td>
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
            icon={Undo2}
            title="No borrowing records yet"
            text="Drinks lent out or borrowed in from outside the business show up here."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                Record Borrowing
              </Button>
            }
          />
        )}
      </Card>

      <BorrowModal open={creating} onClose={() => setCreating(false)} onDone={reload} />
    </Page>
  );
}
