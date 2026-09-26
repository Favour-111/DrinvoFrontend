import { ArrowLeftRight, BookOpen, Banknote, Coins, CreditCard, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { PAYMENT_LABEL, SALE_STATUS_LABEL } from '../../utils/format.js';
import { STOCK_STATUS } from '../../utils/units.js';

const TONES = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  brand: 'bg-brand-soft text-brand-ink',
  neutral: 'bg-surface-3 text-ink-2',
};

export function Badge({ tone = 'neutral', dot = true, children, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full py-[2px] pr-1.5 pl-1.5 text-[10px] font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Tag({ children, className }) {
  return <span className={cn('inline-flex h-6 items-center rounded-[7px] bg-surface-3 px-2.5 text-[12px] font-medium whitespace-nowrap text-ink-2', className)}>{children}</span>;
}

export function StockBadge({ status }) {
  const s = STOCK_STATUS[status] || STOCK_STATUS.in;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const STAFF_STATUS = {
  ACTIVE: { tone: 'ok', label: 'Active' },
  PENDING: { tone: 'warn', label: 'Pending approval' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
};
export function StaffStatusBadge({ status }) {
  const s = STAFF_STATUS[status] || STAFF_STATUS.INACTIVE;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const SALE_TONE = { COMPLETED: 'ok', PARTIALLY_RETURNED: 'warn', RETURNED: 'neutral', REFUNDED: 'info', VOIDED: 'bad' };
export function SaleStatusBadge({ status }) {
  return <Badge tone={SALE_TONE[status]}>{SALE_STATUS_LABEL[status] || status}</Badge>;
}

export const PAYMENT_ICON = { CASH: Banknote, POS: CreditCard, TRANSFER: ArrowLeftRight, CREDIT: BookOpen, PART: Coins };
export function PaymentTag({ method }) {
  const Icon = PAYMENT_ICON[method] || Banknote;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
      <Icon size={15} className="text-ink-3" />
      {PAYMENT_LABEL[method] || method}
    </span>
  );
}

const MOVEMENT = {
  OPENING_STOCK: ['Opening stock', 'ok'],
  RESTOCK: ['Restock', 'ok'],
  SALE: ['Sale', 'info'],
  CUSTOMER_RETURN: ['Customer return', 'ok'],
  DAMAGED: ['Damaged', 'bad'],
  LOST: ['Lost', 'bad'],
  EXPIRED: ['Expired', 'warn'],
  SUPPLIER_RETURN: ['Returned to supplier', 'warn'],
  ADJUSTMENT: ['Stock correction', 'neutral'],
  SALE_VOID: ['Sale voided', 'neutral'],
  TRANSFER: ['Transfer', 'info'],
};
export const movementLabel = (type) => MOVEMENT[type]?.[0] || type;
export function MovementType({ type }) {
  const [label, tone] = MOVEMENT[type] || [type, 'neutral'];
  return <span className={cn('inline-flex h-6 items-center rounded-[7px] px-2.5 text-[11px] font-bold tracking-wider uppercase', TONES[tone])}>{label}</span>;
}

/** Percentage change chip, e.g. +12.4% vs yesterday. Always sits on a plain card, so one style covers every case. */
export function Delta({ current, previous }) {
  if (!previous) return null;
  const d = (current - previous) / Math.abs(previous);
  const neg = d < 0;
  const Icon = neg ? TrendingDown : TrendingUp;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold', neg ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok')}>
      {neg ? '−' : '+'}
      {Math.abs(d * 100).toFixed(1)}%
      <Icon size={12} />
    </span>
  );
}
