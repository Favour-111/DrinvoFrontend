import { useState } from 'react';
import { Search, Users } from '../../components/icons.js';
import { Page } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { customerService } from '../../services/index.js';
import { initials, money, timeAgo } from '../../utils/format.js';

/** Lets staff look a customer up. Recording credit repayments is admin-only. */
export default function StaffCustomers() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q);
  const { data, error, reload } = useApi(() => customerService.list({ q: debounced }), [debounced]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  return (
    <Page>
      <div>
        <h1 className="text-[22px] font-bold">Customers</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Look up a customer by name or phone.</p>
      </div>
      <label className="relative w-full sm:max-w-[360px]">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" />
      </label>
      <Card className="py-1.5">
        {data.length ? (
          data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-2 py-3 last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold">{initials(c.name)}</span>
              <div className="min-w-0 flex-1 basis-40">
                <b className="block truncate font-semibold">{c.name}</b>
                <small className="block truncate text-[12.5px] text-ink-3">
                  {c.phone} · last bought {c.lastPurchaseAt ? timeAgo(c.lastPurchaseAt) : 'never'}
                </small>
              </div>
              {c.outstanding > 0 ? (
                <b className="tnum ml-auto text-warn sm:ml-0">{money(c.outstanding)}</b>
              ) : (
                <span className="ml-auto text-[12.5px] text-ink-3 sm:ml-0">No balance owed</span>
              )}
            </div>
          ))
        ) : (
          <EmptyState icon={Users} title={q ? 'No customers match' : 'No customers yet'} text={q ? 'Try another name or phone number.' : 'Customers appear here once a sale is recorded with their name and phone.'} />
        )}
      </Card>
    </Page>
  );
}
