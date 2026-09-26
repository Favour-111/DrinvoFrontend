import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, LogOut, Package, Plus, Receipt, Store, User } from '../components/icons.js';
import { Avatar, Logo } from '../components/ui/Media.jsx';
import { SyncIndicator } from '../components/SyncIndicator.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { cn } from '../utils/cn.js';

const TABS = [
  ['/staff/home', 'Home', Home],
  ['/staff/sale', 'New Sale', Plus],
  ['/staff/sales', 'Sales', Receipt],
  ['/staff/inventory', 'Inventory', Package],
  ['/staff/profile', 'Profile', User],
];

/** Mobile-first shell for staff: top bar on desktop, bottom tab bar on phones, New Sale always one tap away. */
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
      <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 lg:px-6">
          <Logo />
          <nav aria-label="Staff navigation" className="ml-4 hidden gap-1 md:flex">
            {TABS.map(([to, label, Icon]) => {
              const on = isActive(to);
              const isNew = to === '/staff/sale';
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    'flex h-[38px] items-center gap-2 rounded-[10px] px-3.5 font-medium transition-colors duration-150',
                    isNew ? 'bg-brand font-semibold text-on-brand hover:bg-brand-2' : on ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  <Icon size={17} />
                  {label}
                  {isNew && cart.count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{cart.count}</span>}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2.5" ref={ref}>
            <SyncIndicator shopId={shop?.id} />
            <span className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold">
              <Store size={16} className="text-ink-3" />
              <span className="hidden sm:inline">{shop?.name}</span>
            </span>
            <div className="relative">
              <button type="button" aria-label="Account menu" onClick={() => setMenu((m) => !m)} className="rounded-full">
                <Avatar user={user} size={38} />
              </button>
              {menu && (
                <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-60 rounded-[16px] border border-line bg-surface p-2 shadow-pop">
                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <Avatar user={user} size={34} />
                    <span className="min-w-0">
                      <b className="block truncate text-[13.5px]">{user.name}</b>
                      <small className="text-[12px] text-ink-3">Staff · {shop?.name}</small>
                    </span>
                  </div>
                  <div className="mx-1 my-1.5 h-px bg-line-2" />
                  <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-surface-2">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-4 pb-[calc(92px+env(safe-area-inset-bottom))] md:pt-6 md:pb-12 lg:px-6">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav aria-label="Staff navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-surface px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] md:hidden">
        {TABS.map(([to, label, Icon]) => {
          const on = isActive(to);
          if (to === '/staff/sale')
            return (
              <NavLink key={to} to={to} aria-label="New sale" className="flex flex-col items-center gap-[3px] text-[11px] font-semibold text-brand-ink">
                <span className="relative -mt-[22px] grid size-[50px] place-items-center rounded-full bg-brand text-on-brand shadow-pop ring-4 ring-surface">
                  <Plus size={24} />
                  {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10.5px] font-bold text-surface-solid ring-2 ring-surface">{cart.count}</span>}
                </span>
                {label}
              </NavLink>
            );
          return (
            <NavLink key={to} to={to} className={cn('flex flex-col items-center gap-[3px] py-1.5 text-[11px] font-medium transition-colors', on ? 'text-brand' : 'text-ink-3')}>
              <Icon size={22} />
              {label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
