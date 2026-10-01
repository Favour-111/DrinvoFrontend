import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Package, Plus, Receipt, ShoppingCart, TrendingUp, Truck, Wallet } from '../../components/icons.js';
import { Page, PageHeader, Tabs, RANGE_OPTIONS } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, CardLink, StatBar } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Delta, PaymentTag } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SalesChart, ChartLegend } from '../../components/charts/SalesChart.jsx';
import { CustomRange, useRange } from '../../components/RangePicker.jsx';
import { RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { reportService } from '../../services/index.js';
import { greeting, money, num, shortDateTime, todayLong } from '../../utils/format.js';
import { describeStock } from '../../utils/units.js';

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
        <h1 className="text-[22px] font-bold sm:text-[26px]">
          {greeting()}, {user.name.split(' ')[0]} 👋
        </h1>
      </PageHeader>

      <StatBar
        items={[
          { key: 'sales', label: 'Today’s Sales', value: money(today.revenue), icon: Receipt, to: '/admin/sales?range=today', footer: <><Delta current={today.revenue} previous={yesterday.revenue} /> vs yesterday</> },
          { key: 'profit', label: 'Today’s Profit', value: money(today.grossProfit), icon: TrendingUp, to: '/admin/reports', footer: <><Delta current={today.grossProfit} previous={yesterday.grossProfit} /> vs yesterday</> },
          { key: 'tx', label: 'Transactions', value: num(today.transactions), icon: ShoppingCart, to: '/admin/sales?range=today', footer: `${num(today.unitsSold)} bottles sold today` },
          { key: 'inv', label: 'Inventory Value', value: money(inventory.inventoryValue), icon: Package, to: '/admin/inventory', footer: `${inventory.variantCount} sizes in stock` },
          {
            key: 'collected',
            label: 'Cash Collected Today',
            value: money(today.cashCollected),
            icon: Wallet,
            to: '/admin/customers',
            footer: <><Delta current={today.cashCollected} previous={yesterday.cashCollected} /> vs yesterday</>,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Sales Overview" action={<Tabs label="Chart range" options={RANGE_OPTIONS} value={r.range} onChange={r.setRange} />} />
          <div className="mb-1.5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-7">
              {[
                ['Revenue', chart.totals.revenue],
                ['Cost', chart.totals.cost],
                ['Profit', chart.totals.grossProfit, 'text-profit'],
              ].map(([l, v, cls]) => (
                <div key={l}>
                  <small className="block text-[12.5px] text-ink-3">{l}</small>
                  <b className={`tnum text-[21px] font-bold tracking-[-0.02em] ${cls || ''}`}>{money(v)}</b>
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

        <Card className="flex flex-col">
          <CardHeader title="Stock alerts" action={<CardLink to="/admin/inventory?status=low">View inventory</CardLink>} />
          {alerts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
                <Check size={22} />
              </span>
              <p className="text-[14px] font-medium">All stock is healthy</p>
            </div>
          ) : (
            alerts.slice(0, 6).map((v) => (
              <div key={v.variantId} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
                <ProductThumb product={v} size={36} />
                <Link to={`/admin/inventory/${v.variantId}`} className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{v.name}</b>
                  <small className={`text-[12.5px] ${v.status === 'out' ? 'font-semibold text-bad' : 'text-warn'}`}>{v.status === 'out' ? 'Out of stock' : `${describeStock(v)} left`}</small>
                </Link>
                <Button size="sm" onClick={() => setRestock({ variantId: v.variantId })}>
                  Restock
                </Button>
              </div>
            ))
          )}
          {alerts.length > 6 && <p className="hint pt-2">+{alerts.length - 6} more in Inventory</p>}
        </Card>
      </div>

      <Card flush>
        <CardHeader flush title="Recent Sales" action={<CardLink to="/admin/sales">View all</CardLink>} />
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
                  <td className="tnum font-semibold">{s.receiptNumber}</td>
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
      </Card>

      <RestockModal open={Boolean(restock)} onClose={() => setRestock(null)} variantId={restock?.variantId} onDone={reload} />
    </Page>
  );
}
