import { useEffect, useState } from 'react';
import { Ban, Calendar, Check, Plus, Trash2, Wallet, Receipt, Undo2 } from '../icons.js';
import { Modal, ConfirmDialog } from '../ui/Modal.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Field, FormError, Input, MoneyInput, Select, Stepper, Switch, Textarea } from '../ui/Form.jsx';
import { Combobox } from '../ui/Combobox.jsx';
import { ProductThumb } from '../ui/Media.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { PAYMENT_ICON } from '../ui/Badge.jsx';
import { inventoryService, salesService, customerService } from '../../services/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { isoDate, money, plural, PAYMENT_LABEL } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, minimumFor, priceFor, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const REASONS = ['Customer changed mind', 'Damaged or expired', 'Wrong item sold', 'Other'];

/** Return items against the original sale. The sale itself is never deleted. */
export function ReturnModal({ open, onClose, sale, onDone }) {
  const toast = useToast();
  const isCredit = sale.paymentMethod === 'CREDIT';
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState(REASONS[0]);
  const [method, setMethod] = useState(isCredit ? 'CREDIT' : 'CASH');
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setQty({});
      setError('');
      setReason(REASONS[0]);
      setRestock(true);
      setMethod(isCredit ? 'CREDIT' : 'CASH');
    }
  }, [open, isCredit]);

  const amount = sale.items.reduce((s, i) => s + (qty[i.id] || 0) * i.unitPrice, 0);
  const bottles = sale.items.reduce((s, i) => s + (qty[i.id] || 0) * i.conversion, 0);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));
      await salesService.processReturn(sale.id, { items, reason, restock, refundMethod: method });
      toast.success('Return recorded. Refund processed.');
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Process return" icon={Undo2} tone="warn"
      description={`The original sale ${sale.receiptNumber} stays in history. This creates a linked return.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={amount <= 0}>
            Confirm return · {money(amount)}
          </Button>
        </>
      }
    >
      <FormError message={error} />
      <div>
        {sale.items.map((i) => {
          const left = i.quantity - i.returnedQuantity;
          return (
            <div key={i.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-3 last:border-0">
              <ProductThumb product={{ color: '#059669' }} size={36} />
              <div className="min-w-0 flex-1">
                <b className="block font-semibold">{i.variantName}</b>
                <small className="text-[12.5px] text-ink-3">
                  Sold {plural(i.quantity, i.unit)} at {money(i.unitPrice)}
                  {i.returnedQuantity ? ` · ${i.returnedQuantity} already returned` : ''}
                </small>
              </div>
              {left > 0 ? (
                <Stepper value={qty[i.id] || 0} min={0} max={left} onChange={(n) => setQty((q) => ({ ...q, [i.id]: n }))} label={`Return quantity for ${i.variantName}`} />
              ) : (
                <span className="text-[12.5px] text-ink-3">Fully returned</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Reason" htmlFor="rt-reason">
          <Select id="rt-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Refund method" htmlFor="rt-method" hint={isCredit ? 'Credit sales are refunded by reducing what the customer owes.' : undefined}>
          <Select id="rt-method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={isCredit}>
            {isCredit ? (
              <option value="CREDIT">Credit to account</option>
            ) : (
              <>
                {['CASH', 'POS', 'TRANSFER'].map((m) => (
                  <option key={m} value={m}>
                    {m === 'CASH' ? 'Cash' : m === 'POS' ? 'POS' : 'Transfer'}
                  </option>
                ))}
                {sale.paymentMethod === 'PART' && <option value="CREDIT">Take off what they owe</option>}
              </>
            )}
          </Select>
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
        <span>Put returned items back into sellable stock</span>
        <Switch checked={restock} onChange={setRestock} label="Return items to stock" />
      </label>
      <div className="flex flex-col gap-2 rounded-[16px] border border-line-2 bg-surface-2 px-4 py-3.5 text-[13.5px]">
        <div className="flex justify-between">
          <span className="text-ink-3">Refund</span>
          <b className="tnum text-[18px]">{money(amount)}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">Inventory</span>
          <b className="tnum">{restock ? `+${plural(bottles, 'bottle')}` : `${plural(bottles, 'bottle')} not restocked`}</b>
        </div>
      </div>
    </Modal>
  );
}

/** Refund money without taking goods back. */
export function RefundModal({ open, onClose, sale, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const max = sale.netTotal;
  const a = Number(amount) || 0;
  const tooMuch = a > max;
  const isCredit = sale.paymentMethod === 'CREDIT';

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setError('');
      setMethod('CASH');
    }
  }, [open]);

  const run = async () => {
    try {
      await salesService.refund(sale.id, { amount: a, method, reason });
      toast.success('Refund processed.');
      onDone?.();
      setConfirming(false);
      onClose();
    } catch (err) {
      setError(err.message);
      setConfirming(false);
      throw err;
    }
  };

  return (
    <>
      <Modal
        open={open && !confirming}
        onClose={onClose}
        title="Refund" icon={Wallet} tone="info"
        description="Refund money without returning items, e.g. an overcharge. Stock does not change."
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={a <= 0 || tooMuch || reason.trim().length < 2} onClick={() => setConfirming(true)}>
              Review refund
            </Button>
          </>
        }
      >
        <FormError message={error} />
        <Field label="Amount" htmlFor="rf-amount" error={tooMuch ? `Refund can’t be more than ${money(max)}.` : undefined} hint={`Up to ${money(max)}`}>
          <MoneyInput id="rf-amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={tooMuch} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Method" htmlFor="rf-method" hint={isCredit ? 'Reduces what the customer owes.' : undefined}>
            <Select id="rf-method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={isCredit}>
              {isCredit ? <option>Credit to account</option> : ['CASH', 'POS', 'TRANSFER'].map((m) => <option key={m} value={m}>{m === 'CASH' ? 'Cash' : m === 'POS' ? 'POS' : 'Transfer'}</option>)}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="rf-reason">
            <Input id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Overcharged on carton price" />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={run} title={`Refund ${money(a)}?`} confirmLabel="Process refund" icon={Wallet}>
        <p>
          A refund of {money(a)} will be linked to {sale.receiptNumber}. Revenue and profit for this sale drop by {money(a)}. Stock does not change.
        </p>
      </ConfirmDialog>
    </>
  );
}

export function VoidModal({ open, onClose, sale, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);
  const run = async () => {
    setBusy(true);
    try {
      await salesService.void(sale.id, { reason });
      toast.success('Sale voided. Stock returned.');
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const back = sale.items.map((i) => `${plural(i.baseQuantity, 'bottle')} of ${i.variantName}`).join(', ');
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Void ${sale.receiptNumber}?`} icon={Ban} tone="bad"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon={Ban} onClick={run} loading={busy} disabled={reason.trim().length < 2}>
            Void sale
          </Button>
        </>
      }
    >
      <FormError message={error} />
      <p className="text-[14px] text-ink-2">{back} will go back into stock and this sale will stop counting toward revenue.</p>
      <p className="text-[14px] text-ink-2">The sale is kept in history, marked Voided. This can’t be undone.</p>
      <Field label="Reason" htmlFor="void-reason">
        <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer cancelled before collection" className="min-h-16" />
      </Field>
    </Modal>
  );
}

const variantOptions = (items) => items.map((v) => ({ value: v.variantId, label: v.name, group: v.productName, sublabel: describeStock(v) }));

/** Compact buyer search for the admin "Log a Sale" modal — find an existing customer or add one by name and phone. */
function CustomerSearch({ value, onChange }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const debounced = useDebounce(q);
  const { data } = useApi(() => customerService.list({ q: debounced }), [debounced]);

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-[11px] border border-brand/25 bg-brand-soft px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <b className="block truncate font-semibold">{value.name}</b>
          <small className="text-[12.5px] text-ink-2">{value.phone}</small>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-[13px] font-semibold text-brand-ink">
          Change
        </button>
      </div>
    );

  if (adding) {
    const valid = name.trim().length >= 2 && phone.trim().length >= 7;
    return (
      <div className="flex flex-col gap-2.5 rounded-[15px] border border-line-2 bg-surface-2 p-3">
        <Field label="Customer name" htmlFor="ls-name">
          <Input id="ls-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Phone number" htmlFor="ls-phone">
          <Input id="ls-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAdding(false)}>
            Back
          </Button>
          <Button size="sm" variant="primary" disabled={!valid} onClick={() => onChange({ id: null, name: name.trim(), phone: phone.trim() })}>
            Use this customer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer name or phone" aria-label="Search customers" />
      <div className="max-h-32 overflow-auto rounded-[15px] border border-line-2 bg-surface-2">
        {(data || []).slice(0, 6).map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c)} className="flex w-full items-center justify-between gap-2 border-b border-line-2 px-3 py-2 text-left text-[13.5px] last:border-0 hover:bg-surface-3">
            <span className="truncate font-medium">{c.name}</span>
            <span className="tnum text-[12.5px] text-ink-3">{c.phone}</span>
          </button>
        ))}
        {data && !data.length && <p className="px-3 py-2 text-[13px] text-ink-3">No customer found.</p>}
      </div>
      <Button size="sm" onClick={() => setAdding(true)}>
        New customer
      </Button>
    </div>
  );
}

/** Lets admin enter a sale that isn't happening live right now — typically a past sale being
 * migrated from paper records. Deducts stock and records payment exactly like a normal sale,
 * just dated to when it actually happened. Always acts on the currently active shop (switch
 * shops with the picker in the header first to log one for a different shop). */
export function LogSaleModal({ open, onClose, onDone }) {
  const { shop } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [date, setDate] = useState(isoDate());
  const [lines, setLines] = useState([]);
  const [draftVariantId, setDraftVariantId] = useState('');
  const [draftCounts, setDraftCounts] = useState({}); // { unit: quantity string }
  const [draftPrices, setDraftPrices] = useState({}); // { unit: price-override string }
  const [draftTotals, setDraftTotals] = useState({}); // { unit: line-total-override string }
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [paidWith, setPaidWith] = useState('CASH');
  const [customer, setCustomer] = useState(null);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(isoDate());
    setLines([]);
    setDraftVariantId('');
    setDraftCounts({});
    setDraftPrices({});
    setDraftTotals({});
    setPaymentMethod('CASH');
    setAmountPaid('');
    setPaidWith('CASH');
    setCustomer(null);
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setItems(null);
      return undefined;
    }
    let live = true;
    setLoadingItems(true);
    inventoryService
      .list()
      .then((r) => {
        if (!live) return;
        setItems(r.items);
        const first = r.items.find((i) => i.quantity > 0) || r.items[0];
        setDraftVariantId(first?.variantId || '');
      })
      .finally(() => live && setLoadingItems(false));
    return () => {
      live = false;
    };
  }, [open]);

  const v = items?.find((i) => i.variantId === draftVariantId);
  const draftUnits = v ? availableUnits(v) : [];
  // One quantity + optional price-override per unit the product is sold in, so e.g. 3 cartons
  // and 3 loose bottles of the same drink can both be entered at once instead of needing two
  // separate "Add" actions.
  const draftRows = draftUnits.map((u) => {
    const quantity = Number(draftCounts[u]) || 0;
    const listPrice = priceFor(v, u);
    const minPrice = minimumFor(v, u);
    const raw = draftPrices[u];
    const rawTotal = draftTotals[u];
    const totalSet = rawTotal !== undefined && rawTotal !== '' && quantity > 0;
    const price = totalSet ? Number(rawTotal) / quantity : raw !== undefined && raw !== '' ? Number(raw) : listPrice;
    const belowMin = quantity > 0 && minPrice > 0 && price < minPrice;
    return { unit: u, quantity, conversion: conversionFor(v, u), listPrice, minPrice, price, belowMin, priceSet: raw !== undefined && raw !== '', totalSet, lineTotal: totalSet ? Number(rawTotal) : price * quantity };
  });
  const draftBase = draftRows.reduce((s, r) => s + r.quantity * r.conversion, 0);
  const draftHasRows = draftRows.some((r) => r.quantity > 0);
  const draftHasError = draftRows.some((r) => r.quantity > 0 && (r.belowMin || r.price < 0));
  const draftValid = Boolean(v && draftHasRows && draftBase > 0 && draftBase <= v.quantity && !draftHasError);

  const onDraftVariant = (id) => {
    setDraftVariantId(id);
    setDraftCounts({});
    setDraftPrices({});
    setDraftTotals({});
  };

  const addLine = () => {
    if (!draftValid) return;
    const newLines = draftRows
      .filter((r) => r.quantity > 0)
      .map((r) => ({ variantId: v.variantId, unit: r.unit, quantity: r.quantity, name: v.name, unitPrice: r.price, lineTotal: r.lineTotal, ...(r.totalSet ? { total: r.lineTotal } : r.priceSet ? { price: r.price } : {}) }));
    setLines((ls) => [...ls, ...newLines]);
    setDraftCounts({});
    setDraftPrices({});
    setDraftTotals({});
  };
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const isPart = paymentMethod === 'PART';
  const onAccount = isPart || paymentMethod === 'CREDIT';
  const paid = Number(amountPaid) || 0;
  const partError = isPart && total > 0 && paid >= total ? 'That covers the whole bill. Choose Cash, POS or Transfer instead.' : '';
  const blocked = !lines.length || !customer || (isPart && (!(paid > 0) || Boolean(partError)));

  const submit = async () => {
    if (blocked) return;
    setSubmitting(true);
    setServerError('');
    try {
      await salesService.create({
        items: lines.map(({ variantId, unit, quantity, price, total }) => ({ variantId, unit, quantity, ...(total != null ? { lineTotal: total } : price != null ? { price } : {}) })),
        paymentMethod,
        ...(customer.id ? { customerId: customer.id } : { customer: { name: customer.name, phone: customer.phone } }),
        ...(isPart ? { amountPaid: paid, paidWith } : {}),
        ...(date !== isoDate() ? { backdatedAt: new Date(`${date}T12:00:00`).toISOString() } : {}),
      });
      toast.success('Sale logged.');
      onDone?.();
      onClose();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Log a Sale" icon={Receipt} tone="brand"
      description={shop ? `For ${shop.name}. Switch shops with the picker in the header first to log one for a different shop.` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} loading={submitting} disabled={blocked}>
            Log Sale{lines.length ? ` · ${money(total)}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={serverError} />

        <Field label="Sale date" htmlFor="ls-date" hint="Pick a past date for a sale you're migrating from paper records. Stock is removed now either way.">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-ink-3" />
            <input id="ls-date" type="date" className="input" value={date} max={isoDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
        </Field>

        <div className="rounded-[16px] border border-line-2 bg-surface-2 p-3.5">
          <div className="label mb-2">Add a product</div>
          {loadingItems ? (
            <Skeleton className="h-10" />
          ) : (
            <div className="flex flex-col gap-2.5">
              <Field label="Product" htmlFor="ls-variant">
                <Combobox id="ls-variant" value={draftVariantId} onChange={onDraftVariant} options={variantOptions(items || [])} placeholder="Search products…" />
              </Field>
              {v && (
                <>
                  <div className={cn('grid gap-2', draftRows.length === 1 ? 'grid-cols-1' : draftRows.length === 2 ? 'grid-cols-2' : 'grid-cols-4')}>
                    {draftRows.map((r) => (
                      <div key={r.unit} className={cn('rounded-[12px] border p-2.5', r.belowMin ? 'border-bad/40 bg-bad-soft' : 'border-line-2 bg-surface')}>
                        <div className="mb-1.5 text-[11px] font-semibold text-ink-3">
                          {UNIT_LABEL[r.unit]}
                          {r.unit !== 'bottle' ? ` ×${r.conversion}` : ''}
                        </div>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="0"
                          value={draftCounts[r.unit] ?? ''}
                          onChange={(e) => setDraftCounts((c) => ({ ...c, [r.unit]: e.target.value }))}
                          className="input mb-1.5 h-9 text-center text-[13px]"
                          aria-label={`Quantity in ${r.unit}s`}
                        />
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          placeholder={String(r.listPrice)}
                          value={draftPrices[r.unit] ?? ''}
                          onChange={(e) => setDraftPrices((p) => ({ ...p, [r.unit]: e.target.value }))}
                          className="input h-8 text-center text-[12px]"
                          aria-label={`Price per ${r.unit}`}
                        />
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          placeholder={r.quantity > 0 ? String(r.listPrice * r.quantity) : 'Total'}
                          value={draftTotals[r.unit] ?? ''}
                          onChange={(e) => setDraftTotals((t) => ({ ...t, [r.unit]: e.target.value }))}
                          className="input mt-1.5 h-8 text-center text-[12px]"
                          aria-label={`Total for ${r.unit}s`}
                        />
                        {r.belowMin && <p className="mt-1 text-[10.5px] font-semibold text-bad">Min {money(r.minPrice)}</p>}
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="primary" icon={Plus} disabled={!draftValid} onClick={addLine} className="self-start">
                    Add{draftHasRows ? ` · ${draftRows.filter((r) => r.quantity > 0).map((r) => plural(r.quantity, r.unit)).join(' + ')}` : ''}
                  </Button>
                  {/* Each unit becomes its own line in the sale (1 carton stays "1 carton", not folded into
                      "13 bottles") — this just previews what Add is about to create, nothing is merged. */}
                  {draftRows.filter((r) => r.quantity > 0).length > 1 && (
                    <p className="hint -mt-1">Adds as {draftRows.filter((r) => r.quantity > 0).length} separate lines, one per unit.</p>
                  )}
                </>
              )}
            </div>
          )}
          {v && (
            <p className="hint mt-2">
              Available: {describeStock(v)}
              {draftBase > v.quantity && ' · Not enough stock'}
            </p>
          )}
          {items && !items.length && <p className="hint mt-2">{shop?.name} has no products in stock yet.</p>}
        </div>

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-[16px] border border-line-2">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Quantity</th>
                    <th className="num">Price</th>
                    <th className="num">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.name}</td>
                      <td className="num tnum">{plural(l.quantity, l.unit)}</td>
                      <td className="num tnum">{money(l.lineTotal)}</td>
                      <td className="num">
                        <IconButton size={30} icon={Trash2} label={`Remove ${l.name} line`} onClick={() => removeLine(i)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-2 bg-surface-2 px-3.5 py-2.5">
              <span className="text-[13px] font-semibold text-ink-2">Total</span>
              <b className="tnum text-[17px]">{money(total)}</b>
            </div>
          </div>
        )}

        <div>
          <div className="label mb-1.5">Payment</div>
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-5 gap-1.5">
            {['CASH', 'POS', 'TRANSFER', 'CREDIT', 'PART'].map((m) => {
              const Icon = PAYMENT_ICON[m];
              const on = paymentMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPaymentMethod(m)}
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
            <Field label="Amount paid now" htmlFor="ls-part-amount" error={partError || undefined}>
              <MoneyInput id="ls-part-amount" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="e.g. 5000" error={partError} />
            </Field>
            <Field label="Paid with">
              <div className="flex gap-1.5">
                {['CASH', 'POS', 'TRANSFER'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaidWith(m)}
                    className={cn('h-9 flex-1 rounded-[9px] border text-[12.5px] font-semibold transition-colors', paidWith === m ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-2')}
                  >
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="text-ink-2">Balance owed on credit</span>
              <b className="tnum text-[17px] text-warn">{money(Math.max(0, total - paid))}</b>
            </div>
          </div>
        )}

        <Field label={onAccount ? 'Customer (owes the balance)' : 'Customer'}>
          <CustomerSearch value={customer} onChange={setCustomer} />
        </Field>
      </div>
    </Modal>
  );
}
