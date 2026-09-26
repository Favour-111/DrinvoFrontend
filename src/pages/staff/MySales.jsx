import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Receipt } from '../../components/icons.js';
import { Page } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { SyncStatusTag } from '../../components/SyncStatusTag.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { listLocalSales } from '../../offline/localSales.js';
import { subscribeSync } from '../../offline/syncManager.js';
import { salesService } from '../../services/index.js';
import { dayLabel, fmtTime, money, PAYMENT_LABEL, SALE_STATUS_LABEL } from '../../utils/format.js';

/** A staff member's own sales, grouped by day. The API only returns their sales. */
export default function MySales() {
  const { shop } = useAuth();
  const [limit, setLimit] = useState(40);
  const { data, error, loading, reload } = useApi(() => salesService.list({ limit }), [limit]);
  const [localSales, setLocalSales] = useState([]);

  const loadLocal = useCallback(() => {
    if (shop?.id) listLocalSales(shop.id).then(setLocalSales);
  }, [shop?.id]);

  useEffect(loadLocal, [loadLocal]);
  useEffect(() => (shop?.id ? subscribeSync(shop.id, loadLocal) : undefined), [shop?.id, loadLocal]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  // A synced local sale also shows up in `data.items` from the server now, so drop the local
  // copy once that happens — everything still queued or that needs attention stays visible.
  const unsynced = localSales.filter((s) => s.syncStatus !== 'SYNCED');
  const items = [...unsynced, ...data.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const groups = [];
  for (const s of items) {
    const label = dayLabel(s.createdAt);
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, items: [] }));
    g.items.push(s);
  }

  return (
    <Page>
      <div>
        <h1 className="text-[22px] font-bold">My Sales</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Only sales you recorded. Ask an admin for returns or corrections.</p>
      </div>
      {groups.length ? (
        groups.map((g) => (
          <Card key={g.label}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{g.label}</h2>
              <span className="hint">
                {g.items.length} sale{g.items.length > 1 ? 's' : ''} · {money(g.items.reduce((s, x) => s + (x.netTotal ?? x.total), 0))}
              </span>
            </div>
            {g.items.map((s) => (
              <Link key={s.id} to={`/staff/sales/${s.id}`} className="flex items-center gap-3 rounded-xl border-b border-line-2 px-2 py-3 last:border-0 hover:bg-surface-2">
                <span className="grid size-[38px] flex-none place-items-center rounded-[10px] bg-brand-soft text-brand">
                  <Receipt size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="tnum block font-semibold">{s.receiptNumber}</b>
                  <small className="block truncate text-[12.5px] text-ink-3">
                    {fmtTime(s.createdAt)} · {s.customer ? s.customer.name : s.items[0]?.variantName}
                    {!s.customer && s.items.length > 1 ? ` +${s.items.length - 1} more` : ''}
                  </small>
                </div>
                <div className="text-right">
                  <b className="tnum block font-semibold">{money(s.total)}</b>
                  {s.syncStatus ? (
                    <SyncStatusTag status={s.syncStatus} className="mt-0.5" />
                  ) : (
                    <small className="text-[12px] text-ink-3">
                      {PAYMENT_LABEL[s.paymentMethod]}
                      {s.status !== 'COMPLETED' ? ` · ${SALE_STATUS_LABEL[s.status]}` : ''}
                    </small>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            text="Your sales will appear here once your first transaction is completed."
            action={
              <ButtonLink to="/staff/sale" variant="primary" icon={Plus}>
                New Sale
              </ButtonLink>
            }
          />
        </Card>
      )}
      {data.total > data.items.length && (
        <Button className="self-center" loading={loading} onClick={() => setLimit((l) => Math.min(100, l + 40))} disabled={limit >= 100}>
          {limit >= 100 ? 'Showing your latest 100 sales' : 'Show more'}
        </Button>
      )}
    </Page>
  );
}
