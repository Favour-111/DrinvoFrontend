import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Coins, Package, Plus, Receipt, Search, SlidersHorizontal, TrendingUp, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, PaymentTag, SaleStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { Avatar, ProductThumb } from '../../components/ui/Media.jsx';
import { LogSaleModal } from '../../components/modals/SaleModals.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { salesService, staffService } from '../../services/index.js';
import { initials, money, num, shortDateTime } from '../../utils/format.js';
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
  const [logging, setLogging] = useState(false);
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
      <PageHeader
        title="Sales"
        subtitle="Every sale, who bought it and who sold it."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setLogging(true)}>
            Log a Sale
          </Button>
        }
      />
      <StatBar
        items={[
          { key: 'count', label: 'Sales', value: num(t.count), icon: Receipt, iconTone: 'brand' },
          { key: 'rev', label: 'Revenue', value: money(t.revenue), icon: Wallet, iconTone: 'info' },
          { key: 'cost', label: 'Cost of goods', value: money(t.cost), icon: Package, iconTone: 'neutral' },
          { key: 'profit', label: 'Profit', value: money(t.profit), icon: TrendingUp, iconTone: 'ok' },
        ]}
      />
      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:max-w-[320px] sm:flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input className="input h-10 border-transparent bg-surface-2 pl-10 focus:bg-surface" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Receipt, customer or product" aria-label="Search receipt, customer or product" />
          </label>
          {[
            ['range', 'Date', CalendarDays, [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['all', 'All time']]],
            ['staffId', 'Staff', SlidersHorizontal, [['', 'All staff'], ...(staff.data || []).map((u) => [u.id, u.name])]],
            ['paymentMethod', 'Payment', Coins, [['', 'All payments'], ['CASH', 'Cash'], ['POS', 'POS'], ['TRANSFER', 'Transfer'], ['CREDIT', 'Credit'], ['PART', 'Part payment']]],
            ['status', 'Status', SlidersHorizontal, [['', 'All statuses'], ['COMPLETED', 'Completed'], ['PARTIALLY_RETURNED', 'Partially returned'], ['RETURNED', 'Returned'], ['REFUNDED', 'Refunded'], ['VOIDED', 'Voided']]],
          ].map(([key, label, , opts]) => (
            <Select key={key} aria-label={label} value={f[key]} onChange={(e) => set({ [key]: e.target.value })} className="h-10 w-auto min-w-[150px] flex-1 border-transparent bg-surface-2 sm:flex-none">
              {opts.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          ))}
        </div>
      </Card>

      <Card flush className="overflow-hidden">
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[900px]">
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
                    <tr key={s.id} className="row-link group" onClick={() => navigate(`/admin/sales/${s.id}`)}>
                      <td>
                        <b className="tnum block font-semibold">{s.receiptNumber}</b>
                        <span className="mt-0.5 flex flex-wrap gap-1.5">
                          {s.status !== 'COMPLETED' && <SaleStatusBadge status={s.status} />}
                          {s.totalDiscount > 0 && <Badge tone="warn">Discounted</Badge>}
                        </span>
                      </td>
                      <td>
                        {s.customer ? (
                          <span className="flex items-center gap-2.5">
                            <span className="grid size-8 flex-none place-items-center rounded-full bg-brand-soft text-[11.5px] font-bold text-brand-ink">{initials(s.customer.name)}</span>
                            <span className="min-w-0">
                              <b className="block font-medium">{s.customer.name}</b>
                              <small className="tnum text-[12px] text-ink-3">{s.customer.phone}</small>
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-3">Walk-in</span>
                        )}
                      </td>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <ProductThumb product={{ name: s.items[0]?.variantName }} size={28} />
                          <span>{itemsSummary(s)}</span>
                        </span>
                      </td>
                      <td className="num font-semibold">{money(s.netTotal)}</td>
                      <td className="num">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[12.5px] font-semibold tnum', s.profit >= 0 ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>{money(s.profit)}</span>
                      </td>
                      <td>
                        <PaymentTag method={s.paymentMethod} />
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <Avatar user={s.staff} size={24} />
                          {s.staff?.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="text-ink-3">
                        <span className="flex items-center justify-between gap-2">
                          {shortDateTime(s.createdAt)}
                          <ArrowUpRight size={15} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 bg-surface-2/60 px-5 py-3 text-[13px] text-ink-3">
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
          <EmptyState icon={Receipt} title="No sales match these filters" text="Try a wider date range, or clear the filters to see every sale." action={<Button onClick={() => set({ ...EMPTY, range: 'all' })}>Clear filters</Button>} />
        )}
      </Card>
      <LogSaleModal open={logging} onClose={() => setLogging(false)} onDone={reload} />
    </Page>
  );
}
