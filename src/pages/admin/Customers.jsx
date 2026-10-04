import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Check, Phone, Plus, Search, UserCheck, Users, Wallet } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { CustomerModal } from '../../components/modals/EntityModals.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { customerService } from '../../services/index.js';
import { initials, money, num, timeAgo } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const AVATAR_TONES = ['bg-brand-soft text-brand-ink', 'bg-info-soft text-info', 'bg-warn-soft text-warn', 'bg-ok-soft text-ok', 'bg-surface-3 text-ink-2'];
const toneFor = (name = '') => AVATAR_TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

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
      <StatBar
        items={[
          { key: 'customers', label: 'Customers', value: num(s.customers), icon: Users, iconTone: 'brand', footer: 'at this shop' },
          { key: 'owed', label: 'Owed on credit', value: money(s.outstanding), icon: Wallet, iconTone: 'warn', footer: `${s.customersOwing} ${s.customersOwing === 1 ? 'customer owes' : 'customers owe'} money` },
          { key: 'owing', label: 'Customers owing', value: num(s.customersOwing), icon: UserCheck, iconTone: 'bad', footer: 'with an open balance' },
          { key: 'collected', label: 'Collected this month', value: money(s.collectedThisMonth), icon: Check, iconTone: 'ok', footer: 'credit payments recorded' },
        ]}
      />

      <Card className="p-2.5 sm:p-3">
        <label className="relative block w-full sm:max-w-[380px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input className="input h-10 border-transparent bg-surface-2 pl-10 focus:bg-surface" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone" aria-label="Search customers" />
        </label>
      </Card>

      <Card flush className="overflow-hidden">
        {data.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th className="num">Purchases</th>
                  <th className="num">Total spent</th>
                  <th>Credit</th>
                  <th>Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="row-link group" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className={cn('grid size-10 flex-none place-items-center rounded-[13px] text-[13px] font-bold shadow-[inset_0_0_0_1px_var(--line)]', toneFor(c.name))}>{initials(c.name)}</span>
                        <div className="min-w-0">
                          <b className="block truncate font-semibold">{c.name}</b>
                          {c.businessName && <small className="block truncate text-[12px] text-ink-3">{c.businessName}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 tnum text-ink-2">
                        <Phone size={13} className="text-ink-3" />
                        {c.phone}
                      </span>
                    </td>
                    <td className="num">
                      <span className="tnum inline-flex min-w-[2rem] justify-center rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold">{num(c.purchaseCount)}</span>
                    </td>
                    <td className="num font-semibold">{money(c.totalSpent)}</td>
                    <td>
                      {c.outstanding > 0 ? <Badge tone="warn">{money(c.outstanding)} owed</Badge> : <Badge tone="ok">Clear</Badge>}
                    </td>
                    <td>
                      <span className="flex items-center justify-between gap-2 text-ink-3">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock size={14} />
                          {c.lastPurchaseAt ? timeAgo(c.lastPurchaseAt) : 'No purchases yet'}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={q ? 'No customers match that search' : 'No customers yet'}
            text={q ? 'Try another name or phone number.' : 'Customers appear here as soon as staff record a sale with their name and phone.'}
            action={!q && <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add Customer</Button>}
          />
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
