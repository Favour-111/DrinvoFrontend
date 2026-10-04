import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BarChart3, Download, Layers, Package, Receipt, RotateCcw, ShoppingCart, Tag, TrendingUp, Undo2, Wallet } from '../../components/icons.js';
import { Page, PageHeader, Tabs, RANGE_OPTIONS } from '../../components/ui/Nav.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Sparkline } from '../../components/ui/Sparkline.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { movementLabel } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { SalesChart, ChartLegend } from '../../components/charts/SalesChart.jsx';
import { Meter } from '../../components/Widgets.jsx';
import { CustomRange, useRange } from '../../components/RangePicker.jsx';
import { SalesReportDoc, StockReportDoc } from '../../components/reports/ReportDocs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { usePrint } from '../../hooks/usePrint.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { money, num, pct, PAYMENT_LABEL } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import { reportService } from '../../services/index.js';

const MIX_COLORS = { CASH: 'var(--c-rev)', POS: 'var(--c-cost)', TRANSFER: 'var(--c-profit)', CREDIT: 'var(--warn)', PART: 'var(--info)' };
const LABELS = { today: 'today', '7d': 'the last 7 days', '30d': 'the last 30 days', month: 'this month', year: 'this year', custom: 'the selected dates' };
const REPORT_TABS = [
  ['sales', 'Sales'],
  ['stock', 'Stock Movements'],
];

const KPI_TONE = {
  brand: { bg: 'from-[#e9faf3] via-surface to-surface', border: 'border-brand/15', color: 'var(--brand-2)' },
  profit: { bg: 'from-[#f1ecff] via-surface to-surface', border: 'border-profit/20', color: 'var(--c-profit)' },
  info: { bg: 'from-[#e8f0ff] via-surface to-surface', border: 'border-info/20', color: 'var(--info)' },
  neutral: { bg: 'from-surface-2 via-surface to-surface', border: 'border-line', color: 'var(--ink-2)' },
};

/** Headline figure on a soft tinted gradient, with an optional trend line drawn from the report's daily series. */
function KpiCard({ label, value, note, icon: Icon, tone = 'brand', spark }) {
  const t = KPI_TONE[tone];
  return (
    <div className={cn('relative overflow-hidden rounded-card border bg-linear-to-br p-5 shadow-card', t.bg, t.border)}>
      <div className="flex items-center gap-3">
        <span className={cn('tile size-10 rounded-[12px]', `tile-${tone}`)}>
          <Icon size={18} />
        </span>
        <span className="text-[13.5px] font-medium text-ink-2">{label}</span>
      </div>
      <div className="tnum mt-4 truncate text-[30px] font-bold tracking-[-0.035em] sm:text-[34px]">{value}</div>
      <div className="mt-1.5 text-[12.5px] text-ink-3">{note}</div>
      {spark && spark.length > 1 && <Sparkline values={spark} color={t.color} width={260} height={56} fluid className="mt-4 block" />}
    </div>
  );
}

function SmallStat({ label, value, icon: Icon, tone = 'neutral' }) {
  return (
    <div className="card flex min-w-0 flex-col gap-3 p-4">
      <span className={cn('tile size-9 rounded-[11px]', `tile-${tone}`)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] text-ink-3">{label}</div>
        <div className="tnum mt-0.5 truncate text-[17px] font-bold tracking-[-0.02em]">{value}</div>
      </div>
    </div>
  );
}

function SalesTab({ data, sort, setSort, navigate }) {
  const products = useMemo(() => {
    if (!data) return [];
    return [...data.products].sort((a, b) => (sort.key === 'name' ? sort.dir * a.name.localeCompare(b.name) : sort.dir * (a[sort.key] - b[sort.key])));
  }, [data, sort]);
  const t = data.totals;
  const maxMargin = Math.max(1, ...data.products.map((p) => p.margin));
  const th = (key, label, cls = 'num') => (
    <th className={`${cls} cursor-pointer select-none hover:text-ink`} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'} onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'name' ? 1 : -1 }))}>
      {label}
      {sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard tone="brand" label="Total revenue" icon={Wallet} value={money(t.revenue)} note={`${num(t.transactions)} transactions`} spark={data.series.map((p) => p.revenue)} />
        <KpiCard tone="profit" label="Cost of goods" icon={Package} value={money(t.cost)} note="weighted average cost at time of sale" spark={data.series.map((p) => p.cost)} />
        <KpiCard tone="info" label="Gross profit" icon={TrendingUp} value={money(t.grossProfit)} note={`${pct(t.margin)} gross margin`} spark={data.series.map((p) => p.profit)} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SmallStat label="Units sold" value={num(t.unitsSold)} icon={ShoppingCart} tone="brand" />
        <SmallStat label="Transactions" value={num(t.transactions)} icon={Receipt} tone="info" />
        <SmallStat label="Average sale" value={money(t.averageSale)} icon={Tag} tone="profit" />
        <SmallStat label="Returns" value={num(t.returns)} icon={Undo2} tone="warn" />
        <SmallStat label="Refunds" value={money(t.refunds)} icon={RotateCcw} tone="bad" />
        <SmallStat label="Credit outstanding" value={money(t.creditOutstanding)} icon={Layers} tone="warn" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2.5"><span className="tile tile-brand size-8 rounded-[10px]"><BarChart3 size={16} /></span>Revenue, cost &amp; profit</span>} action={<ChartLegend />} />
          <SalesChart points={data.series} granularity={data.range.granularity} variant="bars" height={280} />
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2.5"><span className="tile tile-info size-8 rounded-[10px]"><Wallet size={16} /></span>Payment methods</span>} action={<span className="hint">share of revenue</span>} />
          <div className="mb-4 flex h-3.5 gap-[3px] overflow-hidden rounded-full">
            {data.paymentMix
              .filter((m) => m.share > 0)
              .map((m) => (
                <i key={m.method} style={{ flex: m.share, background: MIX_COLORS[m.method] }} />
              ))}
          </div>
          {data.paymentMix.map((m) => (
            <div key={m.method} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
              <span className="size-2.5 rounded-[3px]" style={{ background: MIX_COLORS[m.method] }} />
              <b className="flex-1 font-semibold">{PAYMENT_LABEL[m.method]}</b>
              <div className="text-right">
                <b className="tnum block font-semibold">{money(m.amount)}</b>
                <small className="text-[12px] text-ink-3">
                  {pct(m.share)} · {m.count} sales
                </small>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Card flush>
        <CardHeader flush title="Product profitability" action={<span className="hint">Click a column to sort</span>} />
        <div className="overflow-x-auto">
          <table className="table min-w-[820px]">
            <thead>
              <tr>
                {th('name', 'Product', '')}
                {th('unitsSold', 'Units Sold')}
                {th('revenue', 'Revenue')}
                {th('cost', 'Cost')}
                {th('profit', 'Profit')}
                {th('margin', 'Profit Margin')}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.variantId} className="row-link" onClick={() => navigate(`/admin/inventory/${p.variantId}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <ProductThumb product={{ color: '#059669' }} size={30} />
                      <div>
                        <b className="block font-semibold">{p.name}</b>
                        <small className="text-[12px] text-ink-3">{p.category}</small>
                      </div>
                    </div>
                  </td>
                  <td className="num">{num(p.unitsSold)}</td>
                  <td className="num">{money(p.revenue)}</td>
                  <td className="num">{money(p.cost)}</td>
                  <td className="num font-semibold">{money(p.profit)}</td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-2.5">
                      <Meter className="w-20" value={p.margin} max={maxMargin} />
                      <span className="w-14">{pct(p.margin, 2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-3">
                    No sales in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StockTab({ data, navigate }) {
  const t = data.totals;
  const maxQty = Math.max(1, ...data.byType.map((r) => Math.max(r.in, r.out)));
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard tone="brand" label="Stock in" icon={TrendingUp} value={`${num(t.in)} bottles`} note="restocks, returns and corrections" />
        <KpiCard tone="neutral" label="Stock out" icon={Package} value={`${num(t.out)} bottles`} note="sales, damage, loss and corrections" />
        <KpiCard tone="info" label="Net change" icon={ArrowLeftRight} value={`${t.net >= 0 ? '+' : ''}${num(t.net)} bottles`} note="stock in minus stock out" />
      </div>

      <Card flush>
        <CardHeader flush title="By movement type" />
        <div className="overflow-x-auto">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Movements</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.byType.map((r) => (
                <tr key={r.type}>
                  <td className="font-semibold">{movementLabel(r.type)}</td>
                  <td className="num">{num(r.count)}</td>
                  <td className="num text-ok">{r.in ? num(r.in) : '—'}</td>
                  <td className="num text-bad">{r.out ? num(r.out) : '—'}</td>
                  <td className="w-24">
                    <Meter className="w-20" value={Math.max(r.in, r.out)} max={maxQty} />
                  </td>
                </tr>
              ))}
              {!data.byType.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-ink-3">
                    No stock movements in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card flush>
        <CardHeader flush title="By product" />
        <div className="overflow-x-auto">
          <table className="table min-w-[680px]">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.byProduct.map((p) => (
                <tr key={p.variantId} className="row-link" onClick={() => navigate(`/admin/inventory/${p.variantId}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <ProductThumb product={{ color: '#059669' }} size={30} />
                      <div>
                        <b className="block font-semibold">{p.name}</b>
                        <small className="text-[12px] text-ink-3">{p.category}</small>
                      </div>
                    </div>
                  </td>
                  <td className="num text-ok">{p.in ? num(p.in) : '—'}</td>
                  <td className="num text-bad">{p.out ? num(p.out) : '—'}</td>
                  <td className="num font-semibold">
                    {p.net >= 0 ? '+' : ''}
                    {num(p.net)}
                  </td>
                </tr>
              ))}
              {!data.byProduct.length && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-ink-3">
                    No stock movements in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default function Reports() {
  const { business, shop } = useAuth();
  const r = useRange('30d');
  const [tab, setTab] = useState('sales');
  const [sort, setSort] = useState({ key: 'revenue', dir: -1 });
  const navigate = useNavigate();

  const sales = useApi(() => reportService.summary(r.params), [r.key], { enabled: r.valid && tab === 'sales' });
  const stock = useApi(() => reportService.stockMovements(r.params), [r.key], { enabled: r.valid && tab === 'stock' });
  const active = tab === 'sales' ? sales : stock;

  const rangeLabel = `${LABELS[r.range] || 'the selected period'}${active.data?.range?.days > 1 ? ` (${active.data.range.days} days)` : ''}`;
  const { printing, print } = usePrint(`${tab === 'sales' ? 'Sales' : 'Stock'}-Report-${new Date().toISOString().slice(0, 10)}`);

  return (
    <Page>
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Showing ${LABELS[r.range]}${active.data?.range.days > 1 ? ` · ${active.data.range.days} days` : ''}.`}
        actions={<Tabs label="Report range" options={RANGE_OPTIONS} value={r.range} onChange={r.setRange} />}
      />
      {r.range === 'custom' && <CustomRange value={r.custom} onChange={r.setCustom} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="Report type" options={REPORT_TABS} value={tab} onChange={setTab} />
        <Button icon={Download} loading={printing} disabled={!active.data} onClick={print}>
          Download {tab === 'sales' ? 'Sales' : 'Stock'} Report (PDF)
        </Button>
      </div>

      {active.error && !active.data ? (
        <ErrorState error={active.error} onRetry={active.reload} />
      ) : !active.data ? (
        <PageSkeleton stats={3} />
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity duration-200', active.loading && 'opacity-60')}>
          {tab === 'sales' ? <SalesTab data={sales.data} sort={sort} setSort={setSort} navigate={navigate} /> : <StockTab data={stock.data} navigate={navigate} />}
        </div>
      )}

      {printing &&
        active.data &&
        createPortal(
          <div id="print-root">
            <div className="print-sheet">
              {tab === 'sales' ? <SalesReportDoc data={sales.data} business={business} shop={shop} rangeLabel={rangeLabel} /> : <StockReportDoc data={stock.data} business={business} shop={shop} rangeLabel={rangeLabel} />}
            </div>
          </div>,
          document.body
        )}
    </Page>
  );
}
