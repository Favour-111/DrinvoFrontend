import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ClipboardList, Package, PackageSearch, Plus, Receipt, ShoppingCart, TrendingUp, Truck, Undo2, Users, Wallet, ArrowLeftRight, BarChart3 } from '../../components/icons.js';
import { Page, PageHeader, Tabs, RANGE_OPTIONS } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, CardLink, StatBar } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Delta, PaymentTag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SalesChart, ChartLegend } from '../../components/charts/SalesChart.jsx';
import { CustomRange, useRange } from '../../components/RangePicker.jsx';
import { RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { reportService } from '../../services/index.js';
import { greeting, initials, money, num, shortDateTime, todayLong } from '../../utils/format.js';
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
          { key: 'sales', label: 'Today’s sales', value: money(today.revenue), icon: Receipt, iconTone: 'brand', to: '/admin/sales?range=today', spark: revenueSpark, footer: <><Delta current={today.revenue} previous={yesterday.revenue} /> vs yesterday</> },
          { key: 'profit', label: 'Today’s profit', value: money(today.grossProfit), icon: TrendingUp, iconTone: 'profit', to: '/admin/reports', spark: profitSpark, sparkColor: 'var(--c-profit)', footer: <><Delta current={today.grossProfit} previous={yesterday.grossProfit} /> vs yesterday</> },
          { key: 'tx', label: 'Transactions', value: num(today.transactions), icon: ShoppingCart, iconTone: 'info', to: '/admin/sales?range=today', footer: `${num(today.unitsSold)} bottles sold today` },
          { key: 'inv', label: 'Inventory value', value: money(inventory.inventoryValue), icon: Package, iconTone: 'ok', to: '/admin/inventory', footer: `${inventory.variantCount} sizes in stock` },
          { key: 'collected', label: 'Cash collected', value: money(today.cashCollected), icon: Wallet, iconTone: 'warn', to: '/admin/customers', footer: <><Delta current={today.cashCollected} previous={yesterday.cashCollected} /> vs yesterday</> },
        ]}
      />

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <span className="blob -top-16 -right-10 size-56 opacity-35" aria-hidden="true" />
          <div className="relative">
            <CardHeader
              title={
                <span className="flex items-center gap-2.5">
                  <span className="tile tile-brand size-8 rounded-[10px]">
                    <BarChart3 size={16} />
                  </span>
                  Sales overview
                </span>
              }
              action={<Tabs label="Chart range" options={RANGE_OPTIONS} value={r.range} onChange={r.setRange} />}
            />
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  ['Revenue', chart.totals.revenue, 'text-ink'],
                  ['Cost', chart.totals.cost, 'text-ink-2'],
                  ['Profit', chart.totals.grossProfit, 'text-profit'],
                ].map(([l, v, cls]) => (
                  <div key={l}>
                    <small className="block text-[12.5px] text-ink-3">{l}</small>
                    <b className={`tnum text-[22px] font-bold tracking-[-0.02em] ${cls}`}>{money(v)}</b>
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
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <span className="blob -top-14 -left-12 size-40 opacity-50" aria-hidden="true" />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <CardHeader
              title={
                <span className="flex items-center gap-2.5">
                  <span className="tile tile-bad size-8 rounded-[10px]">
                    <Package size={16} />
                  </span>
                  Stock alerts
                  {alerts.length > 0 && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[11.5px] font-bold text-bad">{alerts.length}</span>}
                </span>
              }
              action={<CardLink to="/admin/inventory?status=low">View all</CardLink>}
            />
            {alerts.length === 0 ? (
              <EmptyState
                className="flex-1 py-8"
                icon={Check}
                title="All stock is healthy"
                text="Nothing is low or out right now. We’ll flag it here the moment something is."
              />
            ) : (
              <div className="flex flex-col">
                {alerts.slice(0, 6).map((v) => (
                  <div key={v.variantId} className="group -mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-surface-2">
                    <ProductThumb product={v} size={38} />
                    <Link to={`/admin/inventory/${v.variantId}`} className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{v.name}</b>
                      <span className={`mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium ${v.status === 'out' ? 'text-bad' : 'text-warn'}`}>
                        <i className={`size-1.5 rounded-full ${v.status === 'out' ? 'bg-bad' : 'bg-warn'}`} />
                        {v.status === 'out' ? 'Out of stock' : `${describeStock(v)} left`}
                      </span>
                    </Link>
                    <Button size="sm" onClick={() => setRestock({ variantId: v.variantId })}>
                      Restock
                    </Button>
                  </div>
                ))}
                {alerts.length > 6 && (
                  <Link to="/admin/inventory?status=low" className="mt-2 inline-flex items-center gap-1 pt-1 text-[12.5px] font-semibold text-brand-ink hover:underline">
                    +{alerts.length - 6} more in Inventory <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card flush>
        <CardHeader
          flush
          title={
            <span className="flex items-center gap-2.5">
              <span className="tile tile-brand size-8 rounded-[10px]">
                <Receipt size={16} />
              </span>
              Recent sales
            </span>
          }
          action={<CardLink to="/admin/sales">View all sales</CardLink>}
        />
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

      <RestockModal open={Boolean(restock)} onClose={() => setRestock(null)} variantId={restock?.variantId} onDone={reload} />
    </Page>
  );
}
