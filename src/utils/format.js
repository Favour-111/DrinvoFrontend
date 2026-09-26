export const money = (n) => {
  const v = Number(n) || 0;
  return (v < -0.5 ? '−' : '') + '₦' + Math.abs(Math.round(v)).toLocaleString('en-US');
};

export const moneyShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return '₦' + Math.round(n / 1e3) + 'k';
  return '₦' + Math.round(n);
};

export const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const pct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits).replace(/\.0$/, '')}%`;
export const plural = (n, word) => `${num(n)} ${word}${Math.abs(n) === 1 ? '' : 's'}`;

const d = (x) => (x instanceof Date ? x : new Date(x));
export const fmtDate = (x) => d(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (x) => d(x).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (x) => `${fmtDate(x)}, ${fmtTime(x)}`;
export const isToday = (x) => d(x).toDateString() === new Date().toDateString();
export const isYesterday = (x) => d(x).toDateString() === new Date(Date.now() - 864e5).toDateString();

export function shortDateTime(x) {
  if (isToday(x)) return `Today, ${fmtTime(x)}`;
  return `${d(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${fmtTime(x)}`;
}

export function dayLabel(x) {
  if (isToday(x)) return 'Today';
  if (isYesterday(x)) return 'Yesterday';
  return d(x).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function timeAgo(x) {
  const s = (Date.now() - d(x).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const todayLong = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const isoDate = (x = new Date()) => {
  const t = d(x);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const PAYMENT_LABEL = { CASH: 'Cash', POS: 'POS', TRANSFER: 'Transfer', CREDIT: 'Credit', PART: 'Part payment', RETURN_CREDIT: 'Return credit' };
export const SALE_STATUS_LABEL = {
  COMPLETED: 'Completed',
  PARTIALLY_RETURNED: 'Partially returned',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  VOIDED: 'Voided',
};
