import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Search, Users, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, StatCard } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { CustomerModal } from '../../components/modals/EntityModals.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { customerService } from '../../services/index.js';
import { initials, money, num, timeAgo } from '../../utils/format.js';

export default function Customers() {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const debounced = useDebounce(q);
  const navigate = useNavigate();
  const summary = useApi(() => customerService.summary(), []);
  const { data, error, reload } = useApi(() => customerService.list({ q: debounced }), [debounced]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data || !summary.data) return <PageSkeleton stats={3} chart={false} />;
  const s = summary.data;

  return (
    <Page>
      <PageHeader
        title="Customers"
        subtitle="Everyone who has bought from the shop, and what they owe on credit."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add Customer
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Customers" value={num(s.customers)} icon={Users} footer="at this shop" />
        <StatCard dark label="Owed on credit" value={money(s.outstanding)} icon={Wallet} footer={`${s.customersOwing} customers owe money`} />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Credit collected this month" value={money(s.collectedThisMonth)} icon={Check} footer="payments recorded" />
        </div>
      </div>
      <label className="relative w-full sm:max-w-[360px]">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" />
      </label>
      <Card flush>
        {data.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th className="num">Purchases</th>
                  <th className="num">Total spent</th>
                  <th className="num">Owes</th>
                  <th>Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="row-link" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-[13px] font-bold">{initials(c.name)}</span>
                        <div>
                          <b className="block font-semibold">{c.name}</b>
                          {c.businessName && <small className="text-[12px] text-ink-3">{c.businessName}</small>}
                        </div>
                      </div>
                    </td>
                    <td className="tnum">{c.phone}</td>
                    <td className="num">{num(c.purchaseCount)}</td>
                    <td className="num font-semibold">{money(c.totalSpent)}</td>
                    <td className="num">{c.outstanding > 0 ? <b className="text-warn">{money(c.outstanding)}</b> : <span className="text-ink-3">—</span>}</td>
                    <td className="text-ink-3">{c.lastPurchaseAt ? timeAgo(c.lastPurchaseAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title={q ? 'No customers match' : 'No customers yet'} text={q ? 'Try another name or phone number.' : 'Customers appear here as soon as staff record a sale with their name and phone.'} />
        )}
      </Card>
      <CustomerModal
        open={adding}
        onClose={() => setAdding(false)}
        onDone={() => {
          reload();
          summary.reload();
        }}
      />
    </Page>
  );
}
