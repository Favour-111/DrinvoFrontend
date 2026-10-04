import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Calendar, Check, Pencil, Receipt, Search, ShoppingCart, Trash2, UserPlus, X } from '../../components/icons.js';
import { Chips } from '../../components/ui/Nav.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PAYMENT_ICON } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Field, Input, MoneyInput, Segmented, Stepper } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { ProductCard } from '../../components/ProductCard.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { useLocalProducts } from '../../hooks/useLocalProducts.js';
import { useStockUpdates } from '../../hooks/useStockUpdates.js';
import { useCart, linePrice } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { createLocalSale } from '../../offline/createLocalSale.js';
import { patchLocalProducts } from '../../offline/catalogSync.js';
import { customerService } from '../../services/index.js';
import { isoDate, money, PAYMENT_LABEL } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, mergeStockRows, minimumFor, priceFor, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const Sparkle = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 1l2.4 7.6L22 11l-7.6 2.4L12 21l-2.4-7.6L2 11l7.6-2.4z" />
  </svg>
);

/** Per-unit price for a cart line: type the price to sell at directly (can be above or below the
 * catalog price), checked live against the product's minimum selling price. */
function PriceEditor({ product, unit, override, onChange }) {
  const [editing, setEditing] = useState(false);
  const listPrice = priceFor(product, unit);
  const min = minimumFor(product, unit);
  const price = override != null ? override : listPrice;
  const discount = Math.max(0, listPrice - price);
  const belowMin = min > 0 && price < min;

  // Commits on every keystroke (not just blur) so the cart total and minimum-price check update live.
  const setPrice = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || raw === '') onChange(undefined);
    else onChange(Math.max(0, Math.round(n * 100) / 100));
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-ink-3">₦</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            autoFocus
            value={override ?? ''}
            placeholder={String(listPrice)}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
            className="input h-6 w-20 px-1.5 py-0 text-[12px]"
            aria-invalid={belowMin ? 'true' : undefined}
            aria-label={`Price per ${unit} for ${product.name}`}
          />
          <span className="text-[11px] text-ink-3">/ {unit}</span>
        </div>
        {belowMin && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-bad">
            <AlertTriangle size={11} className="flex-none" /> Below minimum price of {money(min)}.
          </span>
        )}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-brand-ink">
      {discount > 0 && <span className="line-through">{money(listPrice)}</span>}
      <span className={discount > 0 ? 'font-semibold text-ink' : ''}>{money(price)}</span>
      <span>per {unit}</span>
      {discount > 0 && <span className="font-semibold text-warn">−{money(discount)}</span>}
      <Pencil size={10} />
    </button>
  );
}

/** Buyer picker: search existing customers or add a new one by name and phone. */
function CustomerPicker({ value, onChange, total, credit }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const debounced = useDebounce(q);
  const { data } = useApi(() => customerService.list({ q: debounced }), [debounced]);

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-[11px] border border-brand/25 bg-brand-soft px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <b className="block truncate font-semibold">{value.name}</b>
          <small className="text-[12.5px] text-ink-2">
            {value.phone}
            {credit ? ` · owes ${money(total)} for this sale` : value.isNew ? ' · new customer' : ''}
          </small>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-[13px] font-semibold text-brand-ink">
          Change
        </button>
      </div>
    );

  if (adding)
    return <NewCustomer onCancel={() => setAdding(false)} onDone={onChange} />;

  return (
    <div className="flex flex-col gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer name or phone" aria-label="Search customers" />
      <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-3">{q ? 'Matches' : 'Recent customers'}</div>
      <div className="max-h-44 overflow-auto rounded-[15px] border border-line-2 bg-surface-2/60">
        {(data || []).slice(0, 6).map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c)} className="flex w-full items-center justify-between gap-2 border-b border-line-2 px-3 py-2 text-left text-[13.5px] last:border-0 hover:bg-surface-3">
            <span className="truncate font-medium">{c.name}</span>
            <span className="tnum text-[12.5px] text-ink-3">{c.phone}</span>
          </button>
        ))}
        {data && !data.length && <p className="px-3 py-2 text-[13px] text-ink-3">No customer found.</p>}
      </div>
      <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)} className="w-full">
        New customer
      </Button>
    </div>
  );
}

function NewCustomer({ onCancel, onDone }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const valid = name.trim().length >= 2 && phone.trim().length >= 7;
  return (
    <div className="flex flex-col gap-2.5 rounded-[15px] border border-line-2 bg-surface-2 p-3">
      <Field label="Customer name" htmlFor="nc-name">
        <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Phone number" htmlFor="nc-phone">
        <Input id="nc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={onCancel}>
          Back
        </Button>
        <Button size="sm" variant="primary" disabled={!valid} onClick={() => onDone({ id: null, name: name.trim(), phone: phone.trim(), isNew: true })}>
          Use this customer
        </Button>
      </div>
    </div>
  );
}

export default function NewSale() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { shop, business, user } = useAuth();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [sheet, setSheet] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Local-first: products render from IndexedDB instantly, then reconcile with the server in
  // the background. Search below filters this in-memory list — no request per keystroke.
  const { items, loading, error: loadError, reload, setItems } = useLocalProducts(shop?.id);

  useStockUpdates((rows) => {
    setItems((prev) => (prev ? mergeStockRows(prev, rows) : prev));
    if (shop?.id) patchLocalProducts(shop.id, rows);
  });

  useEffect(() => {
    if (items) cart.syncProducts(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheet]);

  const categories = useMemo(() => ['All', ...new Set((items || []).map((p) => p.category))], [items]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items || []).filter((p) => (category === 'All' || p.category === category) && (!needle || `${p.name} ${p.brand}`.toLowerCase().includes(needle)));
  }, [items, q, category]);

  const inCart = (id) => cart.lines.filter((l) => l.product.variantId === id).reduce((s, l) => s + l.quantity, 0);
  const isPart = cart.paymentMethod === 'PART';
  const onAccount = isPart || cart.paymentMethod === 'CREDIT';
  const partPaid = Number(cart.partAmount) || 0;
  const partError = isPart && cart.total > 0 && partPaid >= cart.total ? 'That covers the whole bill. Choose Cash, POS or Transfer instead.' : '';
  const blocked = !cart.lines.length || cart.shortages.size > 0 || cart.priceErrors.size > 0 || !cart.customer || (isPart && (!(partPaid > 0) || partError));

  // Local-first: the sale is written to this device and the cart clears immediately — the staff
  // member never waits on the network. Syncing to the server happens in the background from here.
  const complete = async () => {
    setBusy(true);
    setError('');
    try {
      const sale = await createLocalSale({ shop, business, staff: user, cart, isPart, partPaid });
      cart.clear();
      setSheet(false);
      toast.success(navigator.onLine ? 'Sale completed.' : 'Sale saved. It’ll sync once you’re back online.');
      navigate(`/staff/sale/complete/${sale.id}`, { state: { sale } });
    } catch (err) {
      setError(err.message || 'Could not save this sale on this device.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError && !items) return <ErrorState error={loadError} onRetry={reload} />;
  if (loading) return <PageSkeleton stats={0} chart={false} />;

  return (
    <div className="animate-rise grid items-start gap-[18px] md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_410px]">
      <div className="grid gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.025em]">New Sale</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">Search and add drinks to this sale.</p>
          </div>
        </div>
        <label className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks, e.g. coke 50cl, Hennessy…" aria-label="Search products" className="input h-13 rounded-[16px] border-transparent bg-surface pl-11 text-[15px] shadow-[0_10px_26px_-18px_rgba(16,24,32,0.35)] focus:border-brand/40" />
        </label>
        <Chips label="Category" options={categories.map((c) => [c, c === 'All' ? 'All products' : c])} value={category} onChange={setCategory} />
        {list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
            {list.map((p) => (
              <ProductCard key={p.variantId} product={p} inCart={inCart(p.variantId)} onAdd={cart.add} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={Search} title="No drinks found" text="Check the spelling or pick another category." />
          </div>
        )}
      </div>

      {/* Cart: sticky panel on tablet/desktop, full-screen sheet on phones */}
      <aside
        aria-label="Current sale"
        className={cn(
          'card fixed inset-0 top-[env(safe-area-inset-top)] z-[70] flex flex-col rounded-none border-0 transition-transform md:sticky md:top-[84px] md:z-auto md:max-h-[calc(100dvh-104px)] md:translate-y-0 md:rounded-card md:border',
          sheet ? 'translate-y-0' : 'translate-y-[102%]'
        )}
      >
        <div className="relative flex items-center justify-between gap-3 px-5 pt-5 pb-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-12 flex-none place-items-center rounded-[15px] bg-linear-to-br from-brand-soft to-surface-2 text-brand shadow-[inset_0_0_0_1px_var(--line)]">
              <ShoppingCart size={21} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold">Current Sale</h2>
              <p className="text-[12.5px] text-ink-3">
                {cart.count} item{cart.count === 1 ? '' : 's'} · {shop?.name}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {cart.lines.length > 0 && (
              <Button size="sm" variant="danger-soft" icon={Trash2} onClick={() => setClearing(true)} className="border-transparent bg-transparent shadow-none hover:bg-bad-soft">
                Clear all
              </Button>
            )}
            <button type="button" aria-label="Close cart" onClick={() => setSheet(false)} className="grid size-[34px] place-items-center rounded-[12px] border border-line bg-surface-2 md:hidden">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px]">
          {cart.lines.length ? (
            cart.lines.map((l) => {
              const p = l.product;
              const short = cart.shortages.get(p.variantId);
              const units = availableUnits(p);
              return (
                <div key={l.key} className={cn('flex flex-col gap-3 rounded-[18px] border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,32,0.03)]', short ? 'border-bad/40 bg-bad-soft' : 'border-line-2')}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-16 flex-none place-items-center rounded-[14px]" style={{ background: `color-mix(in srgb, ${p.color || '#059669'} 14%, var(--surface-2))` }}>
                      <ProductThumb product={p} size={56} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[14.5px] font-semibold">{p.name}</b>
                      <PriceEditor product={p} unit={l.unit} override={l.priceOverride} onChange={(priceOverride) => cart.update(l.key, { priceOverride })} />
                    </div>
                    <div className="flex flex-none flex-col items-end gap-2">
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => cart.remove(l.key)} className="grid size-8 place-items-center rounded-[10px] border border-line bg-surface-2 text-ink-3 transition-colors hover:border-bad/40 hover:bg-bad-soft hover:text-bad">
                        <Trash2 size={14} />
                      </button>
                      <b className="tnum text-[15px] font-bold">{money(l.quantity * linePrice(l))}</b>
                    </div>
                  </div>
                  {units.length > 1 && (
                    <Segmented
                      label="Selling unit"
                      value={l.unit}
                      onChange={(unit) => cart.update(l.key, { unit, priceOverride: undefined })}
                      options={units.map((u) => ({ value: u, label: UNIT_LABEL[u], hint: u !== 'bottle' ? `×${conversionFor(p, u)}` : undefined }))}
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Stepper value={l.quantity} onChange={(quantity) => cart.update(l.key, { quantity })} label={`Quantity of ${p.name}`} />
                    <span className="tnum text-[12.5px] text-ink-3">{l.quantity} × {money(linePrice(l))}</span>
                  </div>
                  {short && (
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-bad">
                      <AlertTriangle size={14} className="flex-none" />
                      Not enough stock available. Only {describeStock(p)} left.
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="relative grid size-28 place-items-center rounded-full bg-linear-to-br from-brand-soft to-surface-2 text-brand shadow-[inset_0_0_0_1px_var(--line)]">
                <ShoppingCart size={34} strokeWidth={1.8} />
                <Sparkle className="absolute -top-1 -right-1 size-4 text-brand-3" />
                <Sparkle className="absolute bottom-1 -left-2 size-3 text-brand-2" />
              </span>
              <b className="mt-5 text-[16px] font-semibold">Your cart is empty</b>
              <p className="mt-1.5 max-w-[240px] text-[13.5px] text-ink-3">Tap a drink to add it and start a sale.</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 rounded-[18px] border border-brand/15 bg-linear-to-br from-brand-soft/70 to-surface p-4">
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-ink-2">Total items</span>
              <b className="tnum font-semibold">{cart.count}</b>
            </div>
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-ink-2">Subtotal</span>
              <b className="tnum font-semibold">{money(cart.total + cart.totalDiscount)}</b>
            </div>
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-ink-2">Discount</span>
              <b className={cn('tnum font-semibold', cart.totalDiscount > 0 ? 'text-warn' : 'text-ink-3')}>{cart.totalDiscount > 0 ? `− ${money(cart.totalDiscount)}` : money(0)}</b>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-brand/15 pt-3">
              <span className="text-[15px] font-semibold">Total</span>
              <b className="tnum text-[28px] font-extrabold tracking-[-0.03em] text-brand-ink">{money(cart.total)}</b>
            </div>
          <div className="flex flex-col gap-2.5 pt-1">
          </div>
            {cart.backdatedAt ? (
              <Field label="Sale date" htmlFor="backdate" hint="This is a past sale — it’ll be counted under this date in reports, and stock is removed now.">
                <div className="flex items-center gap-2">
                  <input
                    id="backdate"
                    type="date"
                    className="input"
                    value={isoDate(new Date(cart.backdatedAt))}
                    max={isoDate()}
                    onChange={(e) => e.target.value && cart.setBackdatedAt(new Date(`${e.target.value}T12:00:00`).toISOString())}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => cart.setBackdatedAt(null)}>
                    Use today
                  </Button>
                </div>
              </Field>
            ) : (
              <button
                type="button"
                onClick={() => cart.setBackdatedAt(new Date(`${isoDate(new Date(Date.now() - 864e5))}T12:00:00`).toISOString())}
                className="flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-brand-ink hover:underline"
              >
                <Calendar size={14} /> Logging a past sale? Backdate it
              </button>
            )}
            <div>
              <div className="label mb-1.5">Payment</div>
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-5 gap-1.5">
                {['CASH', 'POS', 'TRANSFER', 'CREDIT', 'PART'].map((m) => {
                  const Icon = PAYMENT_ICON[m];
                  const on = cart.paymentMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => cart.setPayment(m)}
                      className={cn(
                        'flex h-12 flex-col items-center justify-center gap-[3px] rounded-[10px] border text-[12.5px] font-semibold transition-colors duration-150',
                        on ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-3/30'
                      )}
                    >
                      <Icon size={17} />
                      {m === 'PART' ? 'Part pay' : PAYMENT_LABEL[m]}
                    </button>
                  );
                })}
              </div>
            </div>
            {isPart && (
              <div className="flex flex-col gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 p-3">
                <Field label="Amount paid now" htmlFor="part-amount" error={partError || undefined}>
                  <MoneyInput id="part-amount" value={cart.partAmount} onChange={(e) => cart.setPart({ partAmount: e.target.value })} placeholder="e.g. 5000" error={partError} />
                </Field>
                <Field label="Paid with">
                  <Segmented
                    label="Paid with"
                    value={cart.partWith}
                    onChange={(partWith) => cart.setPart({ partWith })}
                    options={['CASH', 'POS', 'TRANSFER'].map((m) => ({ value: m, label: PAYMENT_LABEL[m] }))}
                  />
                </Field>
                <div className="flex items-baseline justify-between text-[13.5px]">
                  <span className="text-ink-2">Balance owed on credit</span>
                  <b className="tnum text-[17px] text-warn">{money(Math.max(0, cart.total - partPaid))}</b>
                </div>
              </div>
            )}
            <Field label={onAccount ? 'Customer (owes the balance)' : 'Customer (optional)'}>
              <CustomerPicker value={cart.customer} onChange={cart.setCustomer} total={isPart ? Math.max(0, cart.total - partPaid) : cart.total} credit={onAccount} />
            </Field>
          </div>
        </div>

        <div className="relative flex flex-col gap-2 border-t border-line-2 px-[18px] pt-3 pb-[calc(14px+env(safe-area-inset-bottom))]">
          {error && <div className="rounded-[14px] border border-bad/15 bg-bad-soft px-3 py-2.5 text-[13px] font-medium text-bad">{error}</div>}
          <Button variant="primary" size="lg" block loading={busy} disabled={blocked} onClick={complete} className="h-[56px] justify-between rounded-[16px] px-5 text-[15px]">
            <span className="inline-flex items-center gap-2"><Check size={18} />Complete Sale{cart.lines.length ? ` • ${money(cart.total)}` : ''}</span>
            <ArrowRight size={18} />
          </Button>
          {cart.shortages.size > 0 ? (
            <p className="text-center text-[12.5px] text-bad">Fix the highlighted items. Stock can’t go below zero.</p>
          ) : cart.priceErrors.size > 0 ? (
            <p className="text-center text-[12.5px] text-bad">Fix the highlighted discount. Price can’t go below the minimum.</p>
          ) : cart.lines.length > 0 && !cart.customer ? (
            <p className="text-center text-[12.5px] text-ink-3">Add the customer’s name and phone to complete the sale.</p>
          ) : null}
        </div>
      </aside>

      {cart.lines.length > 0 && !sheet && (
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-2.5 rounded-[14px] border border-line bg-ink py-3 pr-3.5 pl-4 text-surface-solid shadow-pop md:hidden"
        >
          <span className="text-left">
            <small className="block text-[12px] opacity-70">
              {cart.count} item{cart.count === 1 ? '' : 's'} · {PAYMENT_LABEL[cart.paymentMethod]}
            </small>
            <b className="tnum text-[16px]">{money(cart.total)}</b>
          </span>
          <span className="inline-flex h-[38px] items-center gap-1.5 rounded-[9px] bg-brand px-3 text-[12.5px] font-semibold text-on-brand">
            Review sale <ArrowRight size={16} />
          </span>
        </button>
      )}

      <ConfirmDialog open={clearing} onClose={() => setClearing(false)} onConfirm={async () => cart.clear()} title="Clear this sale?" confirmLabel="Clear sale" icon={Trash2}>
        <p>All items will be removed from the current sale. Nothing has been recorded yet.</p>
      </ConfirmDialog>
    </div>
  );
}
