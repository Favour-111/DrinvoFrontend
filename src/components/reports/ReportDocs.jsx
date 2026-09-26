import { movementLabel } from '../ui/Badge.jsx';
import { fmtDateTime, money, num, pct, PAYMENT_LABEL } from '../../utils/format.js';

/*
 * Printable report documents. Colors are hardcoded hex, not design tokens —
 * same reason as Receipt.jsx: the printed page must look the same regardless
 * of the viewer's light/dark mode, since dark-mode tokens would otherwise
 * print a near-black page.
 */
const ink = '#111827';
const ink2 = '#4b5563';
const ink3 = '#6b7280';
const line = '#e5e7eb';
const brand = '#047857';

const Th = ({ children, num: n }) => (
  <th style={{ textAlign: n ? 'right' : 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: ink3, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${line}` }}>{children}</th>
);
const Td = ({ children, num: n, strong }) => (
  <td style={{ textAlign: n ? 'right' : 'left', padding: '9px 10px', fontSize: 12.5, color: ink, fontWeight: strong ? 700 : 400, borderBottom: `1px solid ${line}` }}>{children}</td>
);

function Letterhead({ title, business, shop, rangeLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, marginBottom: 18, borderBottom: `2px solid ${ink}` }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.28em', color: brand }}>DRINVO</div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: ink }}>{title}</div>
        <div style={{ marginTop: 2, fontSize: 12.5, color: ink2 }}>
          {business?.name} · {shop?.name}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ink }}>{rangeLabel}</div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: ink3 }}>Generated {fmtDateTime(new Date())}</div>
      </div>
    </div>
  );
}

function StatRow({ items }) {
  return (
    <div className="avoid-break" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {items.map(([label, value, accent]) => (
        <div key={label} style={{ flex: 1, border: `1px solid ${line}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: ink3, fontWeight: 600 }}>{label}</div>
          <div style={{ marginTop: 4, fontSize: 19, fontWeight: 800, color: accent || ink }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ margin: '22px 0 8px', fontSize: 13.5, fontWeight: 800, color: ink }}>{children}</div>;
}

export function SalesReportDoc({ data, business, shop, rangeLabel }) {
  const t = data.totals;
  return (
    <div className="report-doc" style={{ fontFamily: 'inherit', color: ink, background: '#fff', padding: '4px 2px' }}>
      <Letterhead title="Sales Report" business={business} shop={shop} rangeLabel={rangeLabel} />

      <StatRow
        items={[
          ['Revenue', money(t.revenue)],
          ['Cost of Goods', money(t.cost)],
          ['Gross Profit', money(t.grossProfit), brand],
          ['Margin', pct(t.margin)],
        ]}
      />
      <StatRow
        items={[
          ['Units Sold', num(t.unitsSold)],
          ['Transactions', num(t.transactions)],
          ['Average Sale', money(t.averageSale)],
          ['Credit Outstanding', money(t.creditOutstanding)],
        ]}
      />

      <SectionTitle>Payment methods</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Method</Th>
            <Th num>Sales</Th>
            <Th num>Amount</Th>
            <Th num>Share</Th>
          </tr>
        </thead>
        <tbody>
          {data.paymentMix
            .filter((m) => m.count > 0)
            .map((m) => (
              <tr key={m.method}>
                <Td>{PAYMENT_LABEL[m.method]}</Td>
                <Td num>{num(m.count)}</Td>
                <Td num>{money(m.amount)}</Td>
                <Td num>{pct(m.share)}</Td>
              </tr>
            ))}
        </tbody>
      </table>

      <SectionTitle>Product profitability</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th num>Units</Th>
            <Th num>Revenue</Th>
            <Th num>Cost</Th>
            <Th num>Profit</Th>
            <Th num>Margin</Th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((p) => (
            <tr key={p.variantId}>
              <Td>{p.name}</Td>
              <Td num>{num(p.unitsSold)}</Td>
              <Td num>{money(p.revenue)}</Td>
              <Td num>{money(p.cost)}</Td>
              <Td num strong>
                {money(p.profit)}
              </Td>
              <Td num>{pct(p.margin, 1)}</Td>
            </tr>
          ))}
          {!data.products.length && (
            <tr>
              <Td>No sales in this period.</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StockReportDoc({ data, business, shop, rangeLabel }) {
  return (
    <div className="report-doc" style={{ fontFamily: 'inherit', color: ink, background: '#fff', padding: '4px 2px' }}>
      <Letterhead title="Stock Movement Report" business={business} shop={shop} rangeLabel={rangeLabel} />

      <StatRow
        items={[
          ['Stock In', `${num(data.totals.in)} bottles`, brand],
          ['Stock Out', `${num(data.totals.out)} bottles`],
          ['Net Change', `${data.totals.net >= 0 ? '+' : ''}${num(data.totals.net)} bottles`, data.totals.net >= 0 ? brand : '#b91c1c'],
        ]}
      />

      <SectionTitle>By movement type</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Type</Th>
            <Th num>Movements</Th>
            <Th num>In</Th>
            <Th num>Out</Th>
          </tr>
        </thead>
        <tbody>
          {data.byType.map((t) => (
            <tr key={t.type}>
              <Td>{movementLabel(t.type)}</Td>
              <Td num>{num(t.count)}</Td>
              <Td num>{t.in ? num(t.in) : '—'}</Td>
              <Td num>{t.out ? num(t.out) : '—'}</Td>
            </tr>
          ))}
          {!data.byType.length && (
            <tr>
              <Td>No stock movements in this period.</Td>
            </tr>
          )}
        </tbody>
      </table>

      <SectionTitle>By product</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Category</Th>
            <Th num>In</Th>
            <Th num>Out</Th>
            <Th num>Net</Th>
          </tr>
        </thead>
        <tbody>
          {data.byProduct.map((p) => (
            <tr key={p.variantId}>
              <Td>{p.name}</Td>
              <Td>{p.category}</Td>
              <Td num>{p.in ? num(p.in) : '—'}</Td>
              <Td num>{p.out ? num(p.out) : '—'}</Td>
              <Td num strong>
                {p.net >= 0 ? '+' : ''}
                {num(p.net)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
