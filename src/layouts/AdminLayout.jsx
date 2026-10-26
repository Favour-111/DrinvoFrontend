import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeftRight, BarChart3, Bell, Bottle, Check, ChevronDown, ChevronRight, ClipboardList, LayoutGrid, LogOut, Menu, MessageCircle, Package, PackageSearch, PanelLeftClose, PanelLeftOpen, Plus, Receipt, Search, Settings, Store, Truck, Undo2, User, Users, Wallet, X,
} from '../components/icons.js';
import { Avatar, Logo, ProductThumb } from '../components/ui/Media.jsx';
import { PoweredBy } from '../components/PoweredBy.jsx';
import { IconButton } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ShopModal } from '../components/modals/EntityModals.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStockUpdates } from '../hooks/useStockUpdates.js';
import { inventoryService, stockCountService } from '../services/index.js';
import { describeStock } from '../utils/units.js';
import { cn } from '../utils/cn.js';

// Grouped like the design: a small heading above each block of pages
const NAV = [
  ['Overview', [['/admin/dashboard', 'Dashboard', LayoutGrid]]],
  [
    'Stock',
    [
      ['/admin/products', 'Products', Bottle],
      ['/admin/inventory', 'Inventory', Package],
      ['/admin/transfers', 'Transfers', ArrowLeftRight],
      ['/admin/stock-counts', 'Physical Counts', ClipboardList],
      ['/admin/suppliers', 'Suppliers', Truck],
    ],
  ],
  [
    'Sales',
    [
      ['/admin/sales', 'Sales', Receipt],
      ['/admin/customers', 'Customers', Wallet],
      ['/admin/borrowings', 'Borrowed Drinks', Undo2],
      ['/admin/on-demand-purchases', 'On-Demand Purchases', PackageSearch],
      ['/admin/share-prices', 'Share Prices', MessageCircle],
    ],
  ],
  [
    'Business',
    [
      ['/admin/staff', 'Staff', Users],
      ['/admin/reports', 'Reports', BarChart3],
      ['/admin/activity', 'Activity', Activity],
      ['/admin/settings', 'Settings', Settings],
    ],
  ],
];
const TITLES = {
  dashboard: 'Dashboard', products: 'Products', inventory: 'Inventory', transfers: 'Stock Transfers', 'stock-counts': 'Physical Stock Counts', borrowings: 'Borrowed Drinks', 'on-demand-purchases': 'On-Demand Purchases', 'share-prices': 'Share Prices', suppliers: 'Suppliers', sales: 'Sales', customers: 'Customers',
  staff: 'Staff', reports: 'Reports & Analytics', activity: 'Activity', settings: 'Settings', profile: 'Profile',
};

function usePopover() {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(null);
    const esc = (e) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, ref, toggle: (id) => setOpen((o) => (o === id ? null : id)) };
}

const PopItem = ({ as: As = 'button', className, ...props }) => (
  <As className={cn('flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-55', className)} {...props} />
);

/** Flat popover panel, floated under its trigger. */
const Pop = ({ className, children, width = 'w-72' }) => (
  <div className={cn('absolute top-[calc(100%+8px)] right-0 z-50 rounded-[16px] border border-line bg-surface p-2 shadow-pop', width, className)}>{children}</div>
);

export default function AdminLayout() {
  const { user, shop, shops, switchShop, refresh, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  // Desktop only: collapse the sidebar down to its icons. Remembered across visits.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('admin-sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      return !c;
    });
  const [alerts, setAlerts] = useState([]);
  const [countAlerts, setCountAlerts] = useState([]);
  const [addingShop, setAddingShop] = useState(false);
  const pop = usePopover();
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.pathname.split('/')[2];

  useEffect(() => setDrawer(false), [location.pathname]);
  // Stock alerts and unreviewed physical-count differences for the bell: once per shop, then every 2 minutes
  useEffect(() => {
    const load = () => {
      inventoryService
        .list()
        .then((r) => setAlerts(r.items.filter((i) => i.status === 'low' || i.status === 'out')))
        .catch(() => {});
      stockCountService
        .list({ status: 'SUBMITTED', hasDifference: true, limit: 10 })
        .then((r) => setCountAlerts(r.items))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [shop?.id]);

  // Live: keep the bell in sync the instant a sale/restock/adjustment changes stock, not just every 2 minutes.
  useStockUpdates((rows) =>
    setAlerts((prev) => {
      const next = prev.filter((a) => !rows.some((r) => r.variantId === a.variantId));
      for (const r of rows) if (r.status === 'low' || r.status === 'out') next.push(r);
      return next;
    })
  );

  const onSearch = (e) => {
    if (e.key !== 'Enter') return;
    const q = e.currentTarget.value.trim();
    if (!q) return;
    navigate(/^(inv-?)?\d{3,}$/i.test(q) ? `/admin/sales?q=${encodeURIComponent(q)}` : `/admin/products?q=${encodeURIComponent(q)}`);
    e.currentTarget.value = '';
  };

  return (
    <div className="min-h-dvh">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col gap-0.5 overflow-y-auto overflow-x-hidden border-r border-line bg-surface px-4 pt-[calc(20px+env(safe-area-inset-top))] pb-4 shadow-pop transition-[transform,width] duration-200 lg:shadow-none lg:translate-x-0',
          collapsed ? 'lg:w-[76px] lg:px-3' : 'lg:w-[260px]',
          drawer ? 'translate-x-0' : '-translate-x-[102%]'
        )}
        aria-label="Main navigation"
      >
        <div className={cn('flex items-center justify-between px-2 pb-5', collapsed && 'lg:flex-col lg:gap-3 lg:px-0')}>
          <Logo className={collapsed ? 'lg:hidden' : undefined} />
          {collapsed && <Logo compact className="hidden lg:flex" />}
          <IconButton icon={X} label="Close menu" className="lg:hidden" onClick={() => setDrawer(false)} />
          <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} size={34} className="max-lg:hidden" onClick={toggleCollapsed} />
        </div>
        {NAV.map(([heading, items]) => (
          <div key={heading} className="flex flex-col gap-0.5">
            <div className={cn('flex items-center gap-2.5 px-2.5 pt-4 pb-2 text-[11.5px] font-medium tracking-[0.04em] text-ink-3', collapsed && 'lg:px-0 lg:pt-3 lg:pb-1.5')}>
              <span className={cn(collapsed && 'lg:hidden')}>{heading}</span>
              <i className="h-px flex-1 bg-line-2" />
            </div>
            {items.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-[42px] items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors duration-150',
                    collapsed && 'lg:justify-center lg:px-0',
                    isActive
                      ? 'bg-brand text-on-brand shadow-[0_8px_18px_-10px_var(--brand)]'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className="flex-none" />
                    <span className={cn('flex-1', collapsed && 'lg:hidden')}>{label}</span>
                    {to.endsWith('inventory') && alerts.length > 0 && (
                      <em className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold not-italic', collapsed && 'lg:absolute lg:top-0.5 lg:right-1 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]', section === 'inventory' ? 'bg-white/20 text-on-brand' : 'bg-warn-soft text-warn')}>{alerts.length}</em>
                    )}
                    {to.endsWith('stock-counts') && countAlerts.length > 0 && (
                      <em className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold not-italic', collapsed && 'lg:absolute lg:top-0.5 lg:right-1 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]', section === 'stock-counts' ? 'bg-white/20 text-on-brand' : 'bg-bad-soft text-bad')}>{countAlerts.length}</em>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="mt-auto pt-4">
          <Link to="/admin/profile" title={collapsed ? user.name : undefined} aria-label={collapsed ? 'Profile' : undefined} className={cn('flex items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 p-2.5 transition-colors hover:bg-surface-3', collapsed && 'lg:justify-center lg:border-transparent lg:bg-transparent lg:p-1')}>
            <Avatar user={user} size={34} />
            <span className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <b className="block truncate text-[13.5px] font-semibold">{user.name}</b>
              <small className="text-[12px] text-ink-3">Admin · {shop?.name}</small>
            </span>
            <ChevronRight size={16} className={cn('text-ink-3', collapsed && 'lg:hidden')} />
          </Link>
        </div>
      </aside>
      {drawer && <div className="animate-fade fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setDrawer(false)} />}

      {/* Main */}
      <main className={cn('min-w-0 px-4 pb-12 transition-[margin] duration-200 sm:px-6 lg:px-8', collapsed ? 'lg:ml-[76px]' : 'lg:ml-[260px]')}>
        <header className="sticky top-0 z-20 flex items-center gap-2.5 bg-bg pt-[calc(18px+env(safe-area-inset-top))] pb-4" ref={pop.ref}>
          <IconButton icon={Menu} label="Open menu" size={38} className="lg:hidden" onClick={() => setDrawer(true)} />
          <h1 className="mr-auto truncate text-[17px] font-semibold">{TITLES[section] || ''}</h1>
          <label className="relative hidden w-[min(280px,28vw)] lg:block">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input onKeyDown={onSearch} placeholder="Search products or receipts" aria-label="Search products or receipts" className="input h-10 pr-12 pl-9" />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">⌘ K</kbd>
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => pop.toggle('shop')}
              aria-expanded={pop.open === 'shop'}
              className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors hover:bg-surface-2"
            >
              <Store size={16} className="text-ink-3" />
              <span className="hidden sm:inline">{shop?.name}</span>
              <ChevronDown size={14} className="text-ink-3" />
            </button>
            {pop.open === 'shop' && (
              <Pop>
                <div className="px-2.5 pt-2 pb-1.5 text-[12px] font-medium text-ink-3">Shops</div>
                {shops.map((s) => (
                  <PopItem
                    key={s.id}
                    onClick={() => {
                      switchShop(s.id);
                      pop.setOpen(null);
                    }}
                  >
                    <Store size={16} className="text-ink-3" />
                    <span className="min-w-0 flex-1">
                      {s.name}
                      <small className="block truncate text-[12px] text-ink-3">{s.address}</small>
                    </span>
                    {s.id === shop?.id && <Check size={16} className="text-brand" />}
                  </PopItem>
                ))}
                <div className="mx-1 my-1.5 h-px bg-line-2" />
                <PopItem
                  onClick={() => {
                    pop.setOpen(null);
                    setAddingShop(true);
                  }}
                >
                  <Plus size={16} />
                  <span>
                    Add shop
                    <small className="block text-[12px] text-ink-3">Start a new branch</small>
                  </span>
                </PopItem>
              </Pop>
            )}
          </div>

          <div className="relative">
            <IconButton icon={Bell} label="Alerts" size={38} onClick={() => pop.toggle('alerts')}>
              {(alerts.length > 0 || countAlerts.length > 0) && <i className="absolute top-1.5 right-2 size-2 rounded-full border-2 border-surface-solid bg-bad" />}
            </IconButton>
            {pop.open === 'alerts' && (
              <Pop width="w-[300px]" className="max-h-[70vh] overflow-auto">
                {countAlerts.length > 0 && (
                  <>
                    <div className="px-2.5 pt-2 pb-1.5 text-[12px] font-medium text-ink-3">Physical count differences</div>
                    {countAlerts.map((c) => (
                      <PopItem key={c.id} as={Link} to={`/admin/stock-counts/${c.id}`} onClick={() => pop.setOpen(null)}>
                        <span className="grid size-[30px] flex-none place-items-center rounded-[9px] bg-bad-soft text-bad">
                          <AlertTriangle size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          {c.countNumber}
                          <small className="block text-[12px] text-ink-3">
                            {c.summary.SHORTAGE > 0 && `${c.summary.SHORTAGE} short`}
                            {c.summary.SHORTAGE > 0 && c.summary.OVERAGE > 0 && ' · '}
                            {c.summary.OVERAGE > 0 && `${c.summary.OVERAGE} over`}
                          </small>
                        </span>
                      </PopItem>
                    ))}
                    <div className="mx-1 my-1.5 h-px bg-line-2" />
                  </>
                )}
                <div className="px-2.5 pt-2 pb-1.5 text-[12px] font-medium text-ink-3">Stock alerts</div>
                {alerts.length === 0 && <p className="px-2.5 pb-2 text-[13px] text-ink-3">All stock levels are healthy.</p>}
                {alerts.map((a) => (
                  <PopItem key={a.variantId} as={Link} to={`/admin/inventory/${a.variantId}`} onClick={() => pop.setOpen(null)}>
                    <ProductThumb product={a} size={30} />
                    <span className="min-w-0 flex-1">
                      {a.name}
                      <small className="block text-[12px] text-ink-3">{a.status === 'out' ? 'Out of stock' : `${describeStock(a)} left`}</small>
                    </span>
                    <Badge tone={a.status === 'out' ? 'bad' : 'warn'}>{a.status === 'out' ? 'Out' : 'Low'}</Badge>
                  </PopItem>
                ))}
              </Pop>
            )}
          </div>

          <div className="relative">
            <button type="button" aria-label="Account menu" onClick={() => pop.toggle('user')} className="rounded-full">
              <Avatar user={user} size={38} />
            </button>
            {pop.open === 'user' && (
              <Pop width="w-64">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <Avatar user={user} size={34} />
                  <span className="min-w-0">
                    <b className="block truncate text-[13.5px]">{user.name}</b>
                    <small className="block truncate text-[12px] text-ink-3">{user.email}</small>
                  </span>
                </div>
                <div className="mx-1 my-1.5 h-px bg-line-2" />
                <PopItem as={Link} to="/admin/profile" onClick={() => pop.setOpen(null)}>
                  <User size={16} /> Profile
                </PopItem>
                <PopItem as={Link} to="/admin/settings" onClick={() => pop.setOpen(null)}>
                  <Settings size={16} /> Settings
                </PopItem>
                <div className="mx-1 my-1.5 h-px bg-line-2" />
                <PopItem onClick={logout}>
                  <LogOut size={16} /> Sign out
                </PopItem>
              </Pop>
            )}
          </div>
        </header>
        {/* Remount pages when the shop changes so all data reloads for that shop */}
        <Outlet key={shop?.id} />
        <PoweredBy className="mt-10" />
      </main>

      <ShopModal
        open={addingShop}
        onClose={() => setAddingShop(false)}
        onDone={async (newShop) => {
          await refresh();
          switchShop(newShop.id);
        }}
      />
    </div>
  );
}
