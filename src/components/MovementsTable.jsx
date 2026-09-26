import { Link } from 'react-router-dom';
import { Package } from './icons.js';
import { MovementType } from './ui/Badge.jsx';
import { EmptyState } from './ui/Feedback.jsx';
import { fmtDateTime, num, plural } from '../utils/format.js';
import { cn } from '../utils/cn.js';

function Reference({ m }) {
  if (m.referenceType === 'Sale' && m.referenceId) return <Link className="font-semibold text-brand hover:underline" to={`/admin/sales/${m.referenceId}`}>{m.referenceNumber}</Link>;
  if (m.referenceType === 'Return' && m.referenceNumber) return <span>{m.referenceNumber}</span>;
  return <span>{m.referenceNumber || '—'}</span>;
}

/** Inventory movement history: type, quantity, balance, user, date, reason. */
export function MovementsTable({ movements, showVariant }) {
  if (!movements.length) return <EmptyState icon={Package} title="No movements yet" text="Restocks, sales, returns and adjustments will appear here." />;
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[820px]">
        <thead>
          <tr>
            <th>Type</th>
            {showVariant && <th>Size</th>}
            <th className="num">Quantity</th>
            <th className="num">Balance</th>
            <th>User</th>
            <th>Date</th>
            <th>Reason</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <MovementType type={m.type} />
              </td>
              {showVariant && <td>{m.variant?.size}</td>}
              <td className={cn('num font-semibold', m.quantity > 0 ? 'text-ok' : 'text-bad')}>
                {m.quantity > 0 ? '+' : '−'}
                {plural(Math.abs(m.quantity), 'bottle')}
              </td>
              <td className="num text-ink-3">{num(m.balanceAfter)}</td>
              <td>{m.performedBy?.name.split(' ')[0]}</td>
              <td className="text-ink-3">{fmtDateTime(m.createdAt)}</td>
              <td className="min-w-[220px] !whitespace-normal">{m.reason}</td>
              <td>
                <Reference m={m} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
