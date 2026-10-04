import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Home, LogOut, Package, Plus, Receipt, Store, User, Wallet } from '../components/icons.js';
import { Avatar, Logo } from '../components/ui/Media.jsx';
import { SyncIndicator } from '../components/SyncIndicator.jsx';
import { PoweredBy } from '../components/PoweredBy.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { cn } from '../utils/cn.js';

const TABS = [
  ['/staff/home', 'Home', Home],
  ['/staff/sale', 'New Sale', Plus],
  ['/staff/sales', 'Sales', Receipt],
  ['/staff/inventory', 'Inventory', Package],
  ['/staff/customers', 'Customers', Wallet],
  ['/staff/profile', 'Profile', User],
];

/** Staff shell: a light glass top bar with pill tabs on desktop, and a raised tab bar with a central New Sale button on phones. */
export default function StaffLayout() {
  const { user, shop, logout } = useAuth();
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setMenu(false), [location.pathname]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const isActive = (to) => location.pathname === to || (to === '/staff/sales' && location.pathname.startsWith('/staff/sales/')) || (to === '/staff/sale' && location.pathname.startsWith('/staff/sale/'));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/85 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(16,24,32,0.02),0_8px_24px_-18px_rgba(16,24,32,0.2)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 lg:px-6">
          <Logo />
          <nav aria-label="Staff navigation" className="ml-3 hidden gap-1 rounded-full bg-surface-2/80 p-1 shadow-[inset_0_0_0_1px_var(--line-2)] md:flex">
            {TABS.map(([to, label, Icon]) => {
              const on = isActive(to);
              const isNew = to === '/staff/sale';
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    'flex h-[36px] items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-all duration-200',
                    isNew
                      ? 'bg-brand text-on-brand font-semibold shadow-[0_6px_16px_-8px_var(--brand-2)] hover:bg-brand-2'
                      : on
                        ? 'bg-surface text-brand-ink font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.08),inset_0_0_0_1px_var(--line)]'
                        : 'text-ink-2 hover:text-ink'
                  )}
                >
                  <Icon size={16} strokeWidth={on || isNew ? 2.2 : 1.8} />
                  {label}
                  {isNew && cart.count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{cart.count}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5" ref={ref}>
            <SyncIndicator shopId={shop?.id} />
            <span className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(16,24,32,0.04)] lg:flex">
              <Store size={15} className="text-brand" />
              <span className="max-w-[160px] truncate">{shop?.name}</span>
            </span>
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 shadow-[0_1px_2px_rgba(16,24,32,0.04)] transition-colors hover:bg-surface-2"
              >
                <Avatar user={user} size={32} />
                <span className="hidden text-left leading-tight md:block">
                  <b className="block text-[13px] font-semibold">{user.name.split(' ')[0]}</b>
                  <small className="text-[11px] text-ink-3">Staff</small>
                </span>
                <ChevronDown size={14} className="hidden text-ink-3 md:block" />
              </button>
              {menu && (
                <div className="animate-pop absolute top-[calc(100%+10px)] right-0 z-50 w-64 overflow-hidden rounded-[18px] border border-line bg-surface p-2 shadow-pop">
                  <div className="flex items-center gap-3 rounded-[12px] bg-surface-2 px-3 py-2.5">
                    <Avatar user={user} size={36} />
                    <span className="min-w-0">
                      <b className="block truncate text-[13.5px]">{user.name}</b>
                      <small className="block truncate text-[12px] text-ink-3">Staff · {shop?.name}</small>
                    </span>
                  </div>
                  <button type="button" onClick={logout} className="mt-1.5 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-bad-soft hover:text-bad">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1280px] flex-1 px-4 pt-4 pb-[calc(104px+env(safe-area-inset-bottom))] md:pt-6 md:pb-12 lg:px-6">
        <Outlet />
        <PoweredBy className="mt-10" />
      </main>

      {/* Bottom tab bar */}
      <nav
        aria-label="Staff navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 rounded-t-[22px] border-t border-line/70 bg-surface/95 px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-18px_rgba(16,24,32,0.3)] backdrop-blur-md md:hidden"
      >
        {TABS.map(([to, label, Icon]) => {
          const on = isActive(to);
          if (to === '/staff/sale')
            return (
              <NavLink key={to} to={to} aria-label="New sale" className="flex flex-col items-center gap-[3px] text-[11px] font-semibold text-brand-ink">
                <span className="relative -mt-[24px] grid size-[54px] place-items-center rounded-full bg-linear-to-br from-brand-2 to-brand text-on-brand shadow-[0_12px_24px_-10px_rgba(16,185,129,0.8)] ring-4 ring-surface">
                  <Plus size={24} />
                  {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10.5px] font-bold text-surface-solid ring-2 ring-surface">{cart.count}</span>}
                </span>
                {label}
              </NavLink>
            );
          return (
            <NavLink key={to} to={to} className={cn('flex flex-col items-center gap-[3px] py-1.5 text-[11px] font-medium transition-colors', on ? 'text-brand' : 'text-ink-3')}>
              <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', on && 'bg-brand-soft')}>
                <Icon size={20} strokeWidth={on ? 2.2 : 1.8} />
              </span>
              {label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
