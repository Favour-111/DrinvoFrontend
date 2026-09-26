import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, moneyShort } from '../../utils/format.js';

const SERIES = [
  { key: 'revenue', name: 'Revenue', color: 'var(--c-rev)' },
  { key: 'cost', name: 'Cost', color: 'var(--c-cost)' },
  { key: 'profit', name: 'Profit', color: 'var(--c-profit)' },
];

export function bucketLabel(key, granularity, count) {
  if (granularity === 'hour') {
    const h = Number(key);
    return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  }
  const d = new Date(`${key}T12:00:00`);
  return count > 10
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[12px] whitespace-nowrap shadow-pop">
      <b className="mb-1 block text-[11px] font-medium text-ink-3">{label}</b>
      {payload.map((p) => (
        <div key={p.dataKey} className="tnum flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span>{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <i className="inline-block size-[9px] rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Revenue / cost / profit over time.
 * variant "area": revenue area + cost line + dashed profit line (dashboard)
 * variant "bars": revenue and cost bars + profit line (reports)
 */
export function SalesChart({ points, granularity, variant = 'area', height = 270 }) {
  const data = points.map((p) => ({ ...p, label: bucketLabel(p.key, granularity, points.length) }));
  const axis = { fill: 'var(--ink-3)', fontSize: 11 };
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Revenue, cost and profit chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--c-rev)" stopOpacity={0.22} />
              <stop offset="1" stopColor="var(--c-rev)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line-2)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={moneyShort} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }} />
          {variant === 'bars' ? (
            <>
              <Bar dataKey="revenue" name="Revenue" fill="var(--c-rev)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="cost" name="Cost" fill="var(--c-cost)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--c-profit)" strokeWidth={2.6} dot={false} />
            </>
          ) : (
            <>
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--c-rev)" strokeWidth={2.4} fill="url(#revFill)" dot={false} activeDot={{ r: 5, strokeWidth: 2.5, fill: 'var(--surface)' }} />
              <Line type="monotone" dataKey="cost" name="Cost" stroke="var(--c-cost)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2.5, fill: 'var(--surface)' }} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--c-profit)" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, strokeWidth: 2.5, fill: 'var(--surface)' }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
