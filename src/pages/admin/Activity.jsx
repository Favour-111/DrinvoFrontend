import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon } from '../../components/icons.js';
import { Chips, Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { activityIcon, activityLink } from '../../components/Widgets.jsx';
import { auditService } from '../../services/index.js';
import { dayLabel, fmtTime, isToday, timeAgo } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const KINDS = [
  ['all', 'All'],
  ['sale', 'Sales'],
  ['inventory', 'Inventory'],
  ['product', 'Products'],
  ['credit', 'Credit'],
  ['staff', 'Staff'],
  ['supplier', 'Suppliers'],
  ['settings', 'Settings'],
];

export default function Activity() {
  const [category, setCategory] = useState('all');
  const [state, setState] = useState({ items: [], page: 0, pages: 1, loading: true, error: null });

  const load = async (page, reset) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await auditService.list({ category, page, limit: 50 });
      setState((s) => ({ items: reset ? res.items : [...s.items, ...res.items], page: res.page, pages: res.pages, loading: false, error: null }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  };

  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  if (state.error && !state.items.length) return <ErrorState error={state.error} onRetry={() => load(1, true)} />;
  if (state.loading && !state.items.length && state.page === 0) return <PageSkeleton stats={0} chart={false} rows={10} />;

  const groups = [];
  for (const a of state.items) {
    const label = dayLabel(a.createdAt);
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, items: [] }));
    g.items.push(a);
  }

  return (
    <Page>
      <PageHeader title="Activity" subtitle="Who did what, and when. Entries can’t be edited or deleted." />
      <Chips label="Filter activity" options={KINDS} value={category} onChange={setCategory} />
      {groups.length ? (
        groups.map((g) => (
          <Card key={g.label}>
            <div className="label mb-1.5">{g.label}</div>
            {g.items.map((a) => {
              const [Icon, tone] = activityIcon(a.category);
              const to = activityLink(a);
              const body = (
                <>
                  <span className={cn('grid size-9 flex-none place-items-center rounded-[10px]', tone)}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px]">
                      <b className="font-semibold">{a.user?.name.split(' ')[0]}</b> {a.summary} {a.target && <b className="font-semibold">{a.target}</b>}
                    </p>
                    {a.detail && <small className="text-[12.5px] text-ink-3">{a.detail}</small>}
                  </div>
                  <small className="flex-none text-[12px] text-ink-3">{isToday(a.createdAt) ? timeAgo(a.createdAt) : fmtTime(a.createdAt)}</small>
                </>
              );
              const cls = 'flex items-center gap-3 rounded-xl border-b border-line-2 px-1.5 py-3 last:border-0';
              return to ? (
                <Link key={a.id} to={to} className={cn(cls, 'hover:bg-surface-2')}>
                  {body}
                </Link>
              ) : (
                <div key={a.id} className={cls}>
                  {body}
                </div>
              );
            })}
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState icon={ActivityIcon} title="No activity" text="Nothing has been recorded for this filter yet." />
        </Card>
      )}
      {state.page < state.pages && (
        <Button className="self-center" loading={state.loading} onClick={() => load(state.page + 1)}>
          Load older activity
        </Button>
      )}
    </Page>
  );
}
