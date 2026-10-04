import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Package, Plus, RotateCcw, Search, ShoppingCart, Store, Truck, Wallet } from '../../components/icons.js';
import { Page, PageHeader, Tabs } from '../../components/ui/Nav.jsx';
import { Card, StatBar } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, Tag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { SupplierModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { supplierService } from '../../services/index.js';
import { initials, money, num, plural, timeAgo } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const AVATAR_TONES = ['bg-brand-soft text-brand-ink', 'bg-info-soft text-info', 'bg-warn-soft text-warn', 'bg-ok-soft text-ok', 'bg-surface-3 text-ink-2'];
const toneFor = (name = '') => AVATAR_TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  spent: (a, b) => b.totalPurchases - a.totalPurchases,
  recent: (a, b) => new Date(b.lastPurchaseAt || 0) - new Date(a.lastPurchaseAt || 0),
};

/** Decorative delivery-truck illustration for the page header. */
function TruckArt() {
  return (
    <svg viewBox="0 0 220 120" className="pointer-events-none absolute right-[190px] bottom-3 hidden h-[104px] w-[190px] opacity-90 lg:block" aria-hidden="true">
      <ellipse cx="110" cy="112" rx="96" ry="6" fill="var(--brand-2)" opacity="0.12" />
      <rect x="18" y="38" width="112" height="56" rx="8" fill="color-mix(in srgb, var(--brand-2) 18%, var(--surface))" stroke="var(--brand-2)" strokeOpacity="0.35" />
      <rect x="130" y="54" width="62" height="40" rx="7" fill="color-mix(in srgb, var(--brand-2) 26%, var(--surface))" stroke="var(--brand-2)" strokeOpacity="0.4" />
      <path d="M140 60h30l12 14v20h-42z" fill="var(--surface)" opacity="0.85" />
      <circle cx="52" cy="98" r="11" fill="var(--surface)" stroke="var(--brand-2)" strokeWidth="3" />
      <circle cx="158" cy="98" r="11" fill="var(--surface)" stroke="var(--brand-2)" strokeWidth="3" />
      <rect x="40" y="52" width="36" height="22" rx="4" fill="var(--brand-2)" opacity="0.7" />
      <rect x="82" y="52" width="36" height="22" rx="4" fill="var(--brand-3)" opacity="0.5" />
      <rect x="150" y="14" width="22" height="24" rx="4" fill="var(--c-profit)" opacity="0.35" />
      <rect x="176" y="24" width="20" height="18" rx="4" fill="var(--warn)" opacity="0.35" />
    </svg>
  );
}

function SupplierCard({ s, archivedView }) {
  return (
    <Link to={`/admin/suppliers/${s.id}`} className="card card-lift group flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3.5">
        <span className={cn('grid size-12 flex-none place-items-center rounded-[15px] text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line)]', toneFor(s.name))}>{initials(s.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <b className="truncate text-[15px] font-semibold">{s.name}</b>
            {archivedView ? <Badge tone="bad">Deleted</Badge> : <Badge tone="ok">Active</Badge>}
          </div>
          <small className="mt-0.5 block truncate text-[12.5px] text-ink-3">
            {[s.contacts?.[0]?.name, s.contacts?.[0]?.phone].filter(Boolean).join(' · ') || 'No contact added'}
            {s.contacts?.length > 1 && ` · +${s.contacts.length - 1} more`}
          </small>
        </div>
      </div>

      <div className="flex min-h-[28px] flex-wrap gap-1.5">
        {s.products.length ? (
          s.products.slice(0, 4).map((p) => (
            <Tag key={p.id} className="bg-surface-2 shadow-[inset_0_0_0_1px_var(--line)]">
              {p.name}
            </Tag>
          ))
        ) : (
          <span className="text-[12.5px] text-ink-3">No products linked yet</span>
        )}
        {s.products.length > 4 && <Tag>+{s.products.length - 4} more</Tag>}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 rounded-[14px] bg-surface-2/70 p-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <Metric icon={ShoppingCart} tone="tile-brand" label="Purchases" value={money(s.totalPurchases)} />
        <Metric icon={Package} tone="tile-info" label="Restocks" value={num(s.purchaseCount)} />
        <Metric icon={CalendarClock} tone="tile-profit" label="Last restock" value={s.lastPurchaseAt ? timeAgo(s.lastPurchaseAt) : '—'} />
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={cn('tile size-8 rounded-[9px]', tone)}>
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-ink-3">{label}</div>
        <div className="tnum truncate text-[13px] font-semibold">{value}</div>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const { data, error, reload } = useApi(() => supplierService.list({ status }), [status]);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const matches = (s) =>
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      s.contacts?.some((c) => `${c.name} ${c.phone}`.toLowerCase().includes(needle)) ||
      s.products.some((p) => p.name.toLowerCase().includes(needle));
    return data.filter(matches).sort(SORTS[sort]);
  }, [data, q, sort]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  const totalSpent = data.reduce((n, s) => n + s.totalPurchases, 0);
  const totalRestocks = data.reduce((n, s) => n + s.purchaseCount, 0);
  const linkedProducts = new Set(data.flatMap((s) => s.products.map((p) => p.id))).size;
  const archivedView = status === 'ARCHIVED';
  const filtered = Boolean(q);

  return (
    <Page>
      <div className="relative">
        <PageHeader
          crumbs={[['Dashboard', '/admin/dashboard'], ['Suppliers']]}
          title="Suppliers"
          subtitle="Manage your suppliers, track purchases and build strong relationships."
          actions={
            !archivedView && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add Supplier
              </Button>
            )
          }
        />
        <TruckArt />
      </div>

      <StatBar
        items={[
          { key: 'suppliers', label: 'Suppliers', value: num(data.length), icon: Truck, iconTone: 'brand', footer: archivedView ? 'in the deleted list' : 'active in this shop' },
          { key: 'spent', label: 'Total purchased', value: money(totalSpent), icon: Wallet, iconTone: 'ok', footer: 'across all suppliers' },
          { key: 'restocks', label: 'Total restocks', value: num(totalRestocks), icon: Package, iconTone: 'info', footer: 'stock deliveries recorded' },
          { key: 'products', label: 'Products sourced', value: num(linkedProducts), icon: Store, iconTone: 'profit', footer: 'linked to a supplier' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          label="Supplier status"
          value={status}
          onChange={setStatus}
          options={[
            ['ACTIVE', 'Active'],
            ['ARCHIVED', 'Deleted'],
          ]}
        />
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:ml-auto sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-[280px] sm:flex-none">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input className="input h-10 pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers or products" aria-label="Search suppliers" />
          </label>
          <Select aria-label="Sort suppliers" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 w-auto min-w-[170px]">
            <option value="name">Sort: name A–Z</option>
            <option value="spent">Sort: most purchased</option>
            <option value="recent">Sort: recent restock</option>
          </Select>
        </div>
      </div>

      {visible.length ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
          {visible.map((s) => (
            <SupplierCard key={s.id} s={s} archivedView={archivedView} />
          ))}
          {!archivedView && !filtered && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-brand/25 bg-brand-soft/30 p-6 text-center transition-colors hover:border-brand/50 hover:bg-brand-soft/50"
            >
              <span className="grid size-14 place-items-center rounded-[18px] bg-surface text-brand shadow-[0_10px_24px_-14px_var(--brand-2)] transition-transform group-hover:scale-105">
                <Plus size={26} />
              </span>
              <span>
                <b className="block text-[14.5px] font-semibold">Add a new supplier</b>
                <small className="mt-1 block max-w-[240px] text-[12.5px] text-ink-3">Keep track of who you buy from and every restock.</small>
              </span>
            </button>
          )}
        </div>
      ) : data.length && filtered ? (
        <Card>
          <EmptyState icon={Search} title="No suppliers match that search" text="Try a supplier name, a contact number or a product they supply." action={<Button onClick={() => setQ('')}>Clear search</Button>} />
        </Card>
      ) : archivedView ? (
        <Card>
          <EmptyState icon={RotateCcw} title="No deleted suppliers" text="Suppliers you delete show up here, and can be restored from their page." />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            text="Add the people and businesses you buy stock from, and every restock will be tied back to them."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add Supplier
              </Button>
            }
          />
        </Card>
      )}

      <SupplierModal open={adding} onClose={() => setAdding(false)} onDone={reload} />
    </Page>
  );
}
