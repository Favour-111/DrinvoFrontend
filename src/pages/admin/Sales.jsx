import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Receipt, Search } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, PaymentTag, SaleStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { Avatar } from '../../components/ui/Media.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { salesService, staffService } from '../../services/index.js';
import { money, num, shortDateTime } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

export function itemsSummary(s) {
  const f = s.items[0];
  if (!f) return '';
  const unit = f.unit !== 'bottle' ? ` ${f.unit}${f.quantity > 1 ? 's' : ''}` : '';
  return (
    <>
      {f.variantName} × {f.quantity}
      {unit}
      {s.items.length > 1 && <span className="text-ink-3"> +{s.items.length - 1} more</span>}
    </>
  );
}

const EMPTY = { q: '', range: '7d', staffId: '', paymentMethod: '', status: '' };

export default function Sales() {
  const [params] = useSearchParams();
  const [f, setF] = useState({ ...EMPTY, q: params.get('q') || '', range: params.get('range') || (params.get('q') ? 'all' : '7d') });
  const [page, setPage] = useState(1);
  const q = useDebounce(f.q);
  const navigate = useNavigate();
  const staff = useApi(() => staffService.list(), []);
  const { data, error, loading, reload } = useApi(() => salesService.list({ ...f, q, page, limit: 30 }), [q, f.range, f.staffId, f.paymentMethod, f.status, page]);

  const set = (patch) => {
    setPage(1);
    setF((x) => ({ ...x, ...patch }));
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;
  const t = data.totals;

  return (
    <Page>
      <PageHeader title="Sales" subtitle="Every sale, who bought it and who sold it." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Sales" value={num(t.count)} />
        <MiniStat label="Revenue" value={money(t.revenue)} />
        <MiniStat label="Cost" value={money(t.cost)} />
        <MiniStat label="Profit" value={money(t.profit)} tone="ok" />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full sm:w-auto sm:max-w-[300px] sm:flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Receipt, customer or product" aria-label="Search receipt, customer or product" />
        </label>
        {[
          ['range', 'Date', [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['all', 'All time']]],
          ['staffId', 'Staff', [['', 'All staff'], ...(staff.data || []).map((u) => [u.id, u.name])]],
          ['paymentMethod', 'Payment', [['', 'All payments'], ['CASH', 'Cash'], ['POS', 'POS'], ['TRANSFER', 'Transfer'], ['CREDIT', 'Credit'], ['PART', 'Part payment']]],
          ['status', 'Status', [['', 'All statuses'], ['COMPLETED', 'Completed'], ['PARTIALLY_RETURNED', 'Partially returned'], ['RETURNED', 'Returned'], ['REFUNDED', 'Refunded'], ['VOIDED', 'Voided']]],
        ].map(([key, label, opts]) => (
          <Select key={key} aria-label={label} value={f[key]} onChange={(e) => set({ [key]: e.target.value })} className="w-auto min-w-[140px] flex-1 sm:flex-none">
            {opts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        ))}
      </div>

      <Card flush>
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th className="num">Amount</th>
                    <th className="num">Profit</th>
                    <th>Payment</th>
                    <th>Sold by</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.items.map((s) => (
                    <tr key={s.id} className="row-link" onClick={() => navigate(`/admin/sales/${s.id}`)}>
                      <td>
                        <b className="tnum block font-semibold">{s.receiptNumber}</b>
                        <span className="flex flex-wrap gap-1.5">
                          {s.status !== 'COMPLETED' && <SaleStatusBadge status={s.status} />}
                          {s.totalDiscount > 0 && <Badge tone="warn">Discounted</Badge>}
                        </span>
                      </td>
                      <td>
                        {s.customer ? (
                          <>
                            <b className="block font-medium">{s.customer.name}</b>
                            <small className="tnum text-[12px] text-ink-3">{s.customer.phone}</small>
                          </>
                        ) : (
                          <span className="text-ink-3">Walk-in</span>
                        )}
                      </td>
                      <td>{itemsSummary(s)}</td>
                      <td className="num font-semibold">{money(s.netTotal)}</td>
                      <td className={cn('num', s.profit >= 0 ? 'text-ok' : 'text-bad')}>{money(s.profit)}</td>
                      <td>
                        <PaymentTag method={s.paymentMethod} />
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <Avatar user={s.staff} size={24} />
                          {s.staff?.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="text-ink-3">{shortDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-[13px] text-ink-3">
                <span>
                  Page {data.page} of {data.pages} · {num(data.total)} sales
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
          <EmptyState icon={Receipt} title="No sales match" text="Your sales will appear here once a transaction matches these filters." action={<Button onClick={() => set({ ...EMPTY, range: 'all' })}>Clear filters</Button>} />
        )}
      </Card>
    </Page>
  );
}
