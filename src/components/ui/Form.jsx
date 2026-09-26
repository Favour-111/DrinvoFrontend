import { forwardRef, useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export function Field({ label, hint, error, children, className, htmlFor }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? <span className="text-[12px] font-medium text-bad">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return <input ref={ref} className={cn('input', className)} aria-invalid={error ? 'true' : undefined} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, error, ...props }, ref) {
  return <textarea ref={ref} className={cn('input', className)} aria-invalid={error ? 'true' : undefined} {...props} />;
});

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn('input', className)} aria-invalid={error ? 'true' : undefined} {...props}>
      {children}
    </select>
  );
});

/** Number input with a ₦ prefix. */
export const MoneyInput = forwardRef(function MoneyInput({ className, error, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium text-ink-3">₦</span>
      <input ref={ref} type="number" inputMode="decimal" min="0" step="any" className={cn('input pl-7', className)} aria-invalid={error ? 'true' : undefined} {...props} />
    </div>
  );
});

/** Labelled field bound to react-hook-form. */
export function FormField({ label, hint, name, register, errors, as = 'input', className, children, rules, ...props }) {
  const id = useId();
  const error = name.split('.').reduce((o, k) => o?.[k], errors)?.message;
  const Comp = as === 'select' ? Select : as === 'textarea' ? Textarea : as === 'money' ? MoneyInput : Input;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <Comp id={id} error={error} {...register(name, rules)} {...props}>
        {children}
      </Comp>
    </Field>
  );
}

export function Switch({ checked, onChange, label, id, disabled }) {
  return (
    <span className="relative inline-block h-[22px] w-[38px] flex-none">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
      />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-2" />
      <span className="pointer-events-none absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </span>
  );
}

export function Stepper({ value, onChange, min = 1, max = Infinity, label = 'Quantity' }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-line bg-surface">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-9 place-items-center text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-35">
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (n >= min) onChange(Math.min(max, n));
        }}
        className="tnum h-9 w-12 border-x border-line bg-transparent text-center font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:hidden"
      />
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-9 place-items-center text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-35">
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Small segmented control, e.g. Bottle | Pack ×6 | Carton ×24 */
export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap gap-[3px] rounded-[10px] border border-line-2 bg-surface-3 p-[3px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-[30px] flex-1 rounded-[7px] px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-ink-2 transition-[background,color] duration-150',
            value === o.value && 'bg-brand text-on-brand'
          )}
        >
          {o.label}
          {o.hint && <small className={cn('ml-1 font-medium', value === o.value ? 'text-on-brand/75' : 'text-ink-3')}>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return <div className="rounded-[10px] border border-bad/15 bg-bad-soft px-3.5 py-3 text-[13.5px] font-medium text-bad">{message}</div>;
}
