import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const VARIANTS = {
  primary: 'border-brand bg-brand text-on-brand shadow-[0_6px_16px_-8px_var(--brand-2)] hover:bg-brand-2 hover:border-brand-2 hover:shadow-[0_10px_22px_-10px_var(--brand-2)] active:scale-[0.98] active:bg-brand',
  secondary: 'border-line bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,32,0.04)] hover:bg-surface-2 hover:border-ink-3/30 active:scale-[0.98]',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-2',
  danger: 'border-bad bg-bad text-white hover:brightness-95',
  'danger-soft': 'border-line bg-surface text-bad hover:bg-bad-soft hover:border-bad/25',
  dark: 'border-ink bg-ink text-surface-solid hover:opacity-90',
};
const SIZES = {
  sm: 'h-8 px-3 text-[12.5px] rounded-[9px] gap-1.5',
  md: 'h-10 px-4 text-[13.5px] rounded-[10px] gap-2',
  lg: 'h-[48px] px-5 text-[14.5px] rounded-[12px] gap-2',
};

export const buttonClass = ({ variant = 'secondary', size = 'md', block, className } = {}) =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap border font-semibold transition-[background,border-color,opacity,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className
  );

export const Button = forwardRef(function Button({ variant, size, block, loading, icon: Icon, children, className, type = 'button', disabled, ...props }, ref) {
  return (
    <button ref={ref} type={type} className={buttonClass({ variant, size, block, className })} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ to, variant, size, block, icon: Icon, children, className, ...props }) {
  return (
    <Link to={to} className={buttonClass({ variant, size, block, className })} {...props}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </Link>
  );
}

export function IconButton({ icon: Icon, label, size = 40, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative grid flex-none place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors duration-150 hover:border-ink-3/30 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon size={Math.round(size * 0.42)} />
      {children}
    </button>
  );
}
