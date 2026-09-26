import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export function Tabs({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'h-[34px] rounded-[9px] border px-3 text-[13px] font-medium whitespace-nowrap transition-[background,border-color,color] duration-150',
            value === v ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-3/30 hover:text-ink'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export const RANGE_OPTIONS = [
  ['today', 'Today'],
  ['7d', '7 Days'],
  ['30d', '30 Days'],
  ['month', 'This Month'],
  ['year', 'This Year'],
  ['custom', 'Custom'],
];

export function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex h-8 flex-none items-center rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-[background,border-color,color] duration-150',
            value === v ? 'border-ink bg-ink text-surface-solid' : 'border-line bg-surface text-ink-2 hover:border-ink-3/30'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Crumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
      {items.map(([label, to], i) => (
        <span key={i} className="flex items-center gap-1.5">
          {to ? (
            <Link to={to} className="hover:text-ink">
              {label}
            </Link>
          ) : (
            <span aria-current="page">{label}</span>
          )}
          {i < items.length - 1 && <ChevronRight size={14} />}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs, children }) {
  return (
    <div>
      {crumbs && <Crumbs items={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {children || <h1 className="text-[22px] font-bold sm:text-[26px]">{title}</h1>}
          {subtitle && <p className="mt-1 text-[13.5px] text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Page({ children, className }) {
  return <div className={cn('animate-rise flex flex-col gap-[18px] pt-1.5', className)}>{children}</div>;
}
