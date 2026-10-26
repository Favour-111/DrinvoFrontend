import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ClipboardList, Package, PackageSearch, Plus, Receipt, ShoppingCart, TrendingUp, Truck, Undo2, Users, Wallet, ArrowLeftRight } from '../../components/icons.js';
import { Page, PageHeader, Tabs, RANGE_OPTIONS } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, CardLink, StatBar } from '../../components/ui/Card.jsx';
import { MiniatureStockSummary } from '../../components/MiniatureSummary.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Delta, MiniatureTag, PaymentTag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SalesChart, ChartLegend } from '../../components/charts/SalesChart.jsx';
import { TopSellers } from '../../components/charts/TopSellers.jsx';
import { ActivityTimeline, Meter, StockTicks } from '../../components/Widgets.jsx';
import { CustomRange, useRange } from '../../components/RangePicker.jsx';
import { RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { reportService } from '../../services/index.js';
import { fmtDate, greeting, initials, money, num, plural, shortDateTime, todayLong } from '../../utils/format.js';
import { describeStock } from '../../utils/units.js';

const QUICK_ACTIONS = [
  { to: '/admin/sales', label: 'Log a sale', hint: 'Record a past sale', icon: Receipt, tone: 'brand' },
  { to: '/admin/transfers', label: 'Transfer stock', hint: 'Move between shops', icon: ArrowLeftRight, tone: 'info' },
  { to: '/admin/stock-counts', label: 'Physical count', hint: 'Count what’s on the shelf', icon: ClipboardList, tone: 'warn' },
  { to: '/admin/borrowings', label: 'Borrowed drinks', hint: 'Lend or borrow', icon: Undo2, tone: 'profit' },
  { to: '/admin/on-demand-purchases', label: 'On-demand', hint: 'Buy for a customer', icon: PackageSearch, tone: 'ok' },
  { to: '/admin/customers', label: 'Customers', hint: 'Credit & purchases', icon: Users, tone: 'neutral' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const r = useRange('7d');
  const [restock, setRestock] = useState(null);
  const { data, error, reload, loading } = useApi(() => reportService.dashboard(r.params), [r.key], { enabled: r.valid });

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={4} />;

  const { today, yesterday, inventory, chart, lowStock, outOfStock, recentSales } = data;
  const alerts = [...outOfStock, ...lowStock];
  // One tick per size. Older API responses don't list healthy sizes, so rebuild the strip from the counts we do have.
  const stockHealth =
    data.stockHealth ||
    [
      ...Array.from({ length: Math.max(0, inventory.variantCount - alerts.length) }, (_, i) => ({ variantId: `ok-${i}`, name: 'In stock', status: 'in' })),
      ...lowStock.map((v) => ({ variantId: v.variantId, name: v.name, status: 'low' })),
      ...outOfStock.map((v) => ({ variantId: v.variantId, name: v.name, status: 'out' })),
    ];
  const revenueSpark = chart.points.map((p) => p.revenue);
  const profitSpark = chart.points.map((p) => p.profit);

  return (
    <Page>
      <PageHeader
        subtitle={todayLong()}
        actions={
          <>
            <Button icon={Truck} onClick={() => setRestock({})}>
              Restock
            </Button>
            <ButtonLink to="/admin/products/new" variant="primary" icon={Plus}>
              Add Product
            </ButtonLink>
          </>
        }
      >
        <h1 className="text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">
          {greeting()}, {user.name.split(' ')[0]} 👋
        </h1>
      </PageHeader>

      <StatBar
        items={[
          { key: 'sales', dark: true, label: 'Today’s sales', value: money(today.revenue), icon: Receipt, iconTone: 'brand', to: '/admin/sales?range=today', spark: revenueSpark, footer: <><Delta current={today.revenue} previous={yesterday.revenue} /> vs yesterday</> },
          { key: 'profit', label: 'Today’s profit', value: money(today.grossProfit), icon: TrendingUp, iconTone: 'profit', to: '/admin/reports', spark: profitSpark, sparkColor: 'var(--c-profit)', footer: <><Delta current={today.grossProfit} previous={yesterday.grossProfit} /> vs yesterday</> },
          { key: 'tx', label: 'Transactions', value: num(today.transactions), icon: ShoppingCart, iconTone: 'info', to: '/admin/sales?range=today', footer: `${num(today.unitsSold)} bottles sold today` },
          { key: 'inv', label: 'Inventory value', value: money(inventory.inventoryValue), icon: Package, iconTone: 'ok', to: '/admin/inventory', footer: `${inventory.variantCount} sizes in stock` },
          { key: 'collected', label: 'Cash collected', value: money(today.cashCollected), icon: Wallet, iconTone: 'warn', to: '/admin/customers', footer: <><Delta current={today.cashCollected} previous={yesterday.cashCollected} /> vs yesterday</> },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Sales Overview" action={<Tabs label="Chart range" options={RANGE_OPTIONS} value={r.range} onChange={r.setRange} />} />
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-x-7 gap-y-3">
              {[
                ['Revenue', chart.totals.revenue, 'text-ink'],
                ['Cost', chart.totals.cost, 'text-ink'],
                ['Profit', chart.totals.grossProfit, 'text-profit'],
              ].map(([l, v, cls]) => (
                <div key={l}>
                  <small className="block text-[12.5px] text-ink-3">{l}</small>
                  <b className={`tnum text-[21px] font-bold tracking-[-0.02em] ${cls}`}>{money(v)}</b>
                </div>
              ))}
            </div>
            <ChartLegend />
          </div>
          {r.range === 'custom' && (
            <div className="my-2">
              <CustomRange value={r.custom} onChange={r.setCustom} />
            </div>
          )}
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <SalesChart points={chart.points} granularity={chart.granularity} />
          </div>
        </Card>

        {data.topSellers?.items && <TopSellers data={data.topSellers} />}
      </div>

      <Card flush>
        <CardHeader flush title="Recent Sales" action={<CardLink to="/admin/sales">View all</CardLink>} />
        {recentSales.length === 0 ? (
          <EmptyState icon={Receipt} title="No sales in this period yet" text="Completed sales from every shop show up here as they happen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="num">Amount</th>
                  <th>Payment</th>
                  <th>Sold by</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id} className="row-link" onClick={() => navigate(`/admin/sales/${s.id}`)}>
                    <td>
                      <span className="tnum rounded-[8px] bg-surface-2 px-2 py-1 text-[12.5px] font-semibold">{s.receiptNumber}</span>
                    </td>
                    <td>
                      {s.customer ? (
                        <span className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-[11.5px] font-bold text-brand-ink">{initials(s.customer.name)}</span>
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
                      {s.items[0]?.variantName}
                      {s.items.length > 1 && <span className="text-ink-3"> +{s.items.length - 1} more</span>}
                    </td>
                    <td className="num font-semibold">{money(s.total)}</td>
                    <td>
                      <PaymentTag method={s.paymentMethod} />
                    </td>
                    <td>{s.staff?.name.split(' ')[0]}</td>
                    <td className="text-ink-3">{shortDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Low Stock" action={<CardLink to="/admin/inventory?status=low">View Inventory</CardLink>} />
          {alerts.length === 0 ? (
            <EmptyState className="py-6" icon={Check} title="All stock is healthy" text="Nothing is low or out right now. We’ll flag it here the moment something is." />
          ) : (
            <>
              <div className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">
                {alerts.length} {alerts.length === 1 ? 'size needs' : 'sizes need'} restocking
              </div>
              <StockTicks items={stockHealth} />
              <div className="mt-2.5 mb-1.5 flex flex-wrap gap-4 text-[12.5px] text-ink-2">
                {[
                  ['bg-ok', 'Healthy', Math.max(0, stockHealth.length - alerts.length)],
                  ['bg-warn', 'Low', lowStock.length],
                  ['bg-bad', 'Out', outOfStock.length],
                ].map(([c, l, n]) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <i className={`size-[9px] rounded-full ${c}`} />
                    {l} {n}
                  </span>
                ))}
              </div>
              {lowStock.slice(0, 4).map((v) => (
                <Link key={v.variantId} to={`/admin/inventory/${v.variantId}`} className="-mx-1.5 flex items-center gap-3 rounded-[12px] px-1.5 py-2.5 transition-colors hover:bg-surface-2">
                  <ProductThumb product={v} size={38} />
                  <span className="min-w-0 flex-1">
                    <b className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      <span className="truncate">{v.name}</span>
                      {v.isMiniature && <MiniatureTag />}
                    </b>
                    <small className="text-[12.5px] text-ink-3">{describeStock(v)} remaining</small>
                    <Meter value={v.quantity} max={v.lowStockThreshold} tone="warn" className="mt-1.5" />
                  </span>
                </Link>
              ))}
              {outOfStock.length > 0 && (
                <>
                  <div className="mt-3 mb-1 flex items-center gap-2.5 text-[11.5px] font-medium tracking-[0.04em] text-ink-3">
                    OUT OF STOCK <span className="h-px flex-1 bg-line-2" />
                  </div>
                  {outOfStock.slice(0, 4).map((v) => (
                    <div key={v.variantId} className="-mx-1.5 flex items-center gap-3 rounded-[12px] px-1.5 py-2.5 transition-colors hover:bg-surface-2">
                      <ProductThumb product={v} size={38} />
                      <Link to={`/admin/inventory/${v.variantId}`} className="min-w-0 flex-1">
                        <b className="block truncate text-[14px] font-semibold">{v.name}</b>
                        <small className="text-[12.5px] text-ink-3">0 bottles · sales blocked</small>
                      </Link>
                      <Button size="sm" onClick={() => setRestock({ variantId: v.variantId })}>
                        Restock
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Activity" action={<CardLink to="/admin/activity">View all</CardLink>} />
          {data.recentActivity?.length ? <ActivityTimeline items={data.recentActivity} /> : <p className="py-6 text-center text-[13.5px] text-ink-3">Nothing has happened yet.</p>}
        </Card>

        <Card>
          <CardHeader title="Recently Restocked" action={<CardLink to="/admin/suppliers">Suppliers</CardLink>} />
          {data.recentRestocks?.length ? (
            data.recentRestocks.map((x) => (
              <Link key={x.id} to={`/admin/inventory/${x.variantId}`} className="-mx-1.5 flex items-center gap-3 rounded-[12px] border-b border-line-2 px-1.5 py-3 transition-colors last:border-0 hover:bg-surface-2">
                <ProductThumb product={x} size={36} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] font-semibold">{x.name}</b>
                  <small className="text-[12.5px] text-ink-3">
                    {plural(x.quantity, x.unit)} · {fmtDate(x.createdAt)}
                  </small>
                </span>
                <span className="flex-none text-right">
                  <b className="tnum block font-semibold">{money(x.total)}</b>
                  <small className="text-[12px] text-ink-3">{x.supplier.split(' ')[0]}</small>
                </span>
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-[13.5px] text-ink-3">No restocks recorded yet.</p>
          )}
        </Card>
      </div>

      <MiniatureStockSummary stock={data.miniature?.stock} today={data.miniature?.today} />

      <Card className="p-3.5 sm:p-4">
        <div className="scrollbar-none flex gap-2.5 overflow-x-auto">
          {QUICK_ACTIONS.map(({ to, label, hint, icon: Icon, tone }) => (
            <Link key={to} to={to} className="card-lift group flex min-w-[196px] flex-none items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
              <span className={`tile tile-${tone}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{label}</b>
                <small className="block truncate text-[12px] text-ink-3">{hint}</small>
              </span>
              <ArrowRight size={15} className="flex-none text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
            </Link>
          ))}
        </div>
      </Card>


      <RestockModal open={Boolean(restock)} onClose={() => setRestock(null)} variantId={restock?.variantId} onDone={reload} />
    </Page>
  );
}
