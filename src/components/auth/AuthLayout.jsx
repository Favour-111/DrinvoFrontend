import { forwardRef } from 'react';
import { AlertTriangle, Receipt, TrendingUp, Eye, EyeOff } from '../icons.js';
import { Input } from '../ui/Form.jsx';
import { cn } from '../../utils/cn.js';
import heroImage from '../../assets/auth-hero.jpg';

/** Shared shell for sign-in, sign-up and the pending-approval screen: a dark brand hero on the left, a light form panel on the right. */
export function AuthLayout({ hero, children }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.08fr_1fr]">
      <AuthHero {...hero} />
      <div className="relative grid place-items-center overflow-hidden px-5 py-10">
        <span className="blob -top-24 -right-20 size-[420px] opacity-70" aria-hidden="true" />
        <span className="blob -bottom-24 -left-16 size-[300px] opacity-50" aria-hidden="true" />
        <div className="relative w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}

export function AuthHero({ eyebrow, title, highlight, text, features = [], footer }) {
  return (
    <section className="relative isolate flex min-h-[520px] flex-col justify-between overflow-hidden bg-hero px-6 py-7 text-on-hero sm:px-10 lg:min-h-dvh lg:px-14 lg:py-10">
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[64%] w-full object-cover object-[center_40%] opacity-90 [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)] lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:h-full lg:w-[78%] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_38%)]"
      />
      <span className="pointer-events-none absolute -z-10 inset-0 bg-[radial-gradient(70%_60%_at_15%_20%,rgba(16,185,129,0.22),transparent_70%)]" aria-hidden="true" />
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-3 text-[22px] font-extrabold tracking-[-0.03em]">
          <span className="grid size-11 place-items-center rounded-[14px] bg-linear-to-br from-brand-2 to-brand shadow-[0_10px_24px_-10px_rgba(16,185,129,0.8),inset_0_1px_0_rgba(255,255,255,0.25)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 2.5h5v3l2 3.2c.3.5.5 1.1.5 1.7V19a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19v-8.6c0-.6.2-1.2.5-1.7l2-3.2z" fill="#fff" />
              <path d="M7 13.5h10" stroke="#047857" strokeWidth="2" />
            </svg>
          </span>
          Drinvo
        </span>
        <span className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-[13px] text-on-hero-2 backdrop-blur-sm sm:inline-flex">
          Inventory <i className="size-1 rounded-full bg-brand-3" /> Sales <i className="size-1 rounded-full bg-brand-3" /> Profit
        </span>
      </div>

      <div className="mt-10 max-w-[480px] lg:mt-0">
        {eyebrow && <p className="text-[12.5px] font-semibold tracking-[0.18em] text-brand-3 uppercase">{eyebrow}</p>}
        <h1 className="mt-3 text-[34px] leading-[1.06] font-extrabold tracking-[-0.035em] sm:text-[44px] lg:text-[50px]">
          {title}
          <span className="mt-1 block text-brand-3">{highlight}</span>
        </h1>
        {text && <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-on-hero-2">{text}</p>}
      </div>

      {features.length > 0 && (
        <div className="mt-8 hidden max-w-[400px] flex-col gap-3 lg:flex">
          {features.map(([Icon, label, desc]) => (
            <div key={label} className="flex items-center gap-4 rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3.5 backdrop-blur-sm">
              <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-brand-3/15 text-brand-3 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.2)]">
                <Icon size={19} />
              </span>
              <div>
                <b className="block text-[14.5px] font-semibold">{label}</b>
                <small className="text-[12.5px] leading-snug text-on-hero-2">{desc}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && <div className="mt-8 hidden items-center gap-3 text-[12.5px] text-on-hero-2 lg:flex">{footer}</div>}
    </section>
  );
}

/** The white card that holds a form on the light side. */
export function AuthCard({ children, className }) {
  return (
    <div className={cn('rounded-[28px] border border-white bg-surface p-7 shadow-[0_30px_60px_-30px_rgba(4,120,87,0.35),0_1px_2px_rgba(16,24,32,0.04)] sm:p-9', className)}>
      {children}
    </div>
  );
}

/** A labelled input with a leading icon and an optional show/hide toggle for passwords. */
export const AuthField = forwardRef(function AuthField({ label, icon: Icon, error, toggle, visible, onToggle, className, ...props }, ref) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="relative">
        {Icon && <Icon size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />}
        <Input ref={ref} error={error} className={cn('h-12 rounded-[14px] bg-surface-2/60 focus:bg-surface', Icon ? 'pl-11' : '', toggle ? 'pr-11' : '', className)} {...props} />
        {toggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
      {error && (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-bad">
          <AlertTriangle size={13} /> {error}
        </span>
      )}
    </label>
  );
});

export const AUTH_FEATURES = [
  [Receipt, 'Every sale', 'Receipt, stock deduction and profit in one step'],
  [AlertTriangle, 'Low stock alerts', 'Know what to reorder before you run out'],
  [TrendingUp, 'Real profit', 'Cost recorded at the moment of each sale'],
];
