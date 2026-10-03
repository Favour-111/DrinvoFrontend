import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Avatar } from '../../components/ui/Media.jsx';
import { useApi } from '../../hooks/useApi.js';
import { stockCountService } from '../../services/index.js';
import { shortDateTime } from '../../utils/format.js';

const STATUS_TONE = { SUBMITTED: 'warn', REVIEWED: 'ok' };

export default function StockCounts() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(() => stockCountService.list({ status, page, limit: 30 }), [status, page]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const totals = data.items.reduce(
    (acc, c) => ({ shortage: acc.shortage + c.summary.SHORTAGE, overage: acc.overage + c.summary.OVERAGE, pending: acc.pending + (c.status === 'SUBMITTED' ? 1 : 0) }),
    { shortage: 0, overage: 0, pending: 0 }
  );

  return (
    <Page>
      <PageHeader
        title="Physical Stock Counts"
        subtitle="What staff counted on the shelf vs. what the system expects — nothing adjusts automatically."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/stock-counts/new')}>
            New Count
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Counts" value={data.total} />
        <MiniStat label="Awaiting review" value={totals.pending} tone={totals.pending ? 'warn' : undefined} />
        <MiniStat label="Products short" value={totals.shortage} tone={totals.shortage ? 'bad' : undefined} />
        <MiniStat label="Products over" value={totals.overage} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select aria-label="Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="w-auto min-w-[160px]">
          <option value="">All statuses</option>
          <option value="SUBMITTED">Awaiting review</option>
          <option value="REVIEWED">Reviewed</option>
        </Select>
      </div>

      <Card flush>
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Count No.</th>
                    <th>Counted by</th>
                    <th className="num">Products</th>
                    <th>Differences</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.items.map((c) => (
                    <tr key={c.id} className="row-link" onClick={() => navigate(`/admin/stock-counts/${c.id}`)}>
                      <td className="tnum font-semibold">{c.countNumber}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <Avatar user={c.performedBy} size={24} />
                          {c.performedBy?.name}
                        </span>
                      </td>
                      <td className="num tnum">{c.items.length}</td>
                      <td>
                        <span className="flex flex-wrap gap-1.5">
                          {c.summary.SHORTAGE > 0 && <Badge tone="bad">{c.summary.SHORTAGE} short</Badge>}
                          {c.summary.OVERAGE > 0 && <Badge tone="ok">{c.summary.OVERAGE} over</Badge>}
                          {c.summary.SHORTAGE === 0 && c.summary.OVERAGE === 0 && <Badge tone="neutral">All matched</Badge>}
                        </span>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[c.status]}>{c.status === 'SUBMITTED' ? 'Awaiting review' : 'Reviewed'}</Badge>
                      </td>
                      <td className="text-ink-3">{shortDateTime(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-[13px] text-ink-3">
                <span>
                  Page {data.page} of {data.pages} · {data.total} counts
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
            icon={ClipboardList}
            title="No physical counts yet"
            text="When staff submit a stock count from the shop floor, it shows up here — or start one yourself."
            action={
              <Button variant="primary" icon={Plus} onClick={() => navigate('/admin/stock-counts/new')}>
                New Count
              </Button>
            }
          />
        )}
      </Card>
    </Page>
  );
}
