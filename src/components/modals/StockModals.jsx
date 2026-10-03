import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Plus, SlidersHorizontal, Trash2 } from '../icons.js';
import { Modal, ConfirmDialog } from '../ui/Modal.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Field, FormError, MoneyInput, Select, Textarea } from '../ui/Form.jsx';
import { Combobox } from '../ui/Combobox.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { inventoryService, supplierService, transferService } from '../../services/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { money, plural } from '../../utils/format.js';
import { availableUnits, bigUnit, conversionFor, describeStock, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const variantOptions = (items) => items.map((v) => ({ value: v.variantId, label: v.name, group: v.productName, sublabel: describeStock(v) }));
const supplierOptions = (suppliers) => suppliers.map((s) => ({ value: s.id, label: s.name }));

function FromTo({ before, after, variant, afterLabel }) {
  return (
    <div className="grid items-center gap-2.5 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-[16px] border border-line-2 bg-surface px-3 py-2.5">
        <small className="block text-[12px] text-ink-3">Current stock</small>
        <b className="tnum text-[17px]">{plural(before, 'bottle')}</b>
        {variant && <small className="block text-[12px] text-ink-3">{describeStock(variant, before)}</small>}
      </div>
      <ArrowRight size={18} className="hidden text-ink-3 sm:block" />
      <div className="rounded-xl border border-brand/40 bg-brand-soft px-3 py-2.5">
        <small className="block text-[12px] text-ink-3">{afterLabel}</small>
        <b className="tnum text-[17px]">{plural(Math.max(0, after), 'bottle')}</b>
        {variant && <small className="block text-[12px] text-ink-3">{describeStock(variant, Math.max(0, after))}</small>}
      </div>
    </div>
  );
}

function useStockData(open, withSuppliers) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([inventoryService.list(), withSuppliers ? supplierService.list() : Promise.resolve([])])
      .then(([inv, suppliers]) => live && setData({ items: inv.items, suppliers }))
      .catch(() => live && setData({ items: [], suppliers: [] }));
    return () => {
      live = false;
    };
  }, [open, withSuppliers]);
  return data;
}

/* ------------------------------------------------------------------ */
export function RestockModal({ open, onClose, onDone, variantId, supplierId }) {
  const data = useStockData(open, true);
  const toast = useToast();
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]); // { variantId, unit, quantity, costPerUnit, productName, name }
  const [draft, setDraft] = useState({ variantId: '', unit: 'bottle', quantity: 10, costPerUnit: 0 });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !data) return;
    const first = data.items.find((i) => i.variantId === variantId) || [...data.items].sort((a, b) => a.quantity / (a.lowStockThreshold || 1) - b.quantity / (b.lowStockThreshold || 1))[0];
    setSupplier(supplierId || data.suppliers[0]?.id || '');
    setNotes('');
    setLines([]);
    setServerError('');
    if (first) {
      const u = bigUnit(first);
      setDraft({ variantId: first.variantId, unit: u, quantity: 10, costPerUnit: Math.round(first.avgCost * conversionFor(first, u)) });
    }
  }, [open, data, variantId, supplierId]);

  const v = data?.items.find((i) => i.variantId === draft.variantId);
  const conv = v ? conversionFor(v, draft.unit) : 0;
  const draftQty = Number(draft.quantity) || 0;
  const draftBase = draftQty * conv;
  const draftCost = Number(draft.costPerUnit) || 0;
  const draftValid = Boolean(v && draftBase > 0 && draftCost > 0);

  const onDraftVariant = (id) => {
    const nv = data.items.find((i) => i.variantId === id);
    const u = bigUnit(nv);
    setDraft({ variantId: id, unit: u, quantity: draft.quantity || 10, costPerUnit: Math.round(nv.avgCost * conversionFor(nv, u)) });
  };
  const onDraftUnit = (u) => setDraft((d) => ({ ...d, unit: u, costPerUnit: Math.round(v.avgCost * conversionFor(v, u)) }));

  const addLine = () => {
    if (!draftValid) return;
    setLines((ls) => [...ls, { variantId: draft.variantId, unit: draft.unit, quantity: draftQty, costPerUnit: draftCost, productName: v.productName, name: v.name }]);
  };
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const grandTotal = lines.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);

  const submit = async () => {
    if (!lines.length || !supplier) return;
    setSubmitting(true);
    setServerError('');
    try {
      await inventoryService.restock({
        supplierId: supplier,
        notes,
        items: lines.map(({ variantId: vid, unit, quantity, costPerUnit }) => ({ variantId: vid, unit, quantity, costPerUnit })),
      });
      toast.success('Inventory restocked successfully.');
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
      title="Restock"
      description="Add one or more lines — even different units of the same product, like 10 cartons and 4 bottles — then confirm together as one purchase."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} loading={submitting} disabled={!lines.length || !supplier}>
            Confirm Restock{lines.length ? ` · ${money(grandTotal)}` : ''}
          </Button>
        </>
      }
    >
      {!data ? (
        <Skeleton className="h-64" />
      ) : !data.suppliers.length ? (
        <FormError message="Add a supplier first. Every restock is recorded against the supplier it came from." />
      ) : (
        <div className="flex flex-col gap-3.5">
          <FormError message={serverError} />
          <Field label="Supplier" htmlFor="rs-supplier">
            <Combobox id="rs-supplier" value={supplier} onChange={setSupplier} options={supplierOptions(data.suppliers)} placeholder="Search suppliers…" />
          </Field>

          <div className="rounded-[16px] border border-line-2 bg-surface-2 p-3.5">
            <div className="label mb-2">Add to this restock</div>
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.6fr)_84px_112px_120px_auto]">
              <Field label="Product" htmlFor="rs-variant">
                <Combobox id="rs-variant" value={draft.variantId} onChange={onDraftVariant} options={variantOptions(data.items)} placeholder="Search products…" />
              </Field>
              <Field label="Qty" htmlFor="rs-qty">
                <input
                  id="rs-qty"
                  className="input"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                />
              </Field>
              <Field label="Unit" htmlFor="rs-unit">
                <Select id="rs-unit" value={draft.unit} onChange={(e) => onDraftUnit(e.target.value)}>
                  {v &&
                    availableUnits(v).map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABEL[u]}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={`Cost / ${draft.unit || 'unit'}`} htmlFor="rs-cost">
                <MoneyInput id="rs-cost" value={draft.costPerUnit} onChange={(e) => setDraft((d) => ({ ...d, costPerUnit: e.target.value }))} />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="primary" icon={Plus} disabled={!draftValid} onClick={addLine} className="w-full sm:w-auto">
                  Add
                </Button>
              </div>
            </div>
            {v && draftBase > 0 && (
              <p className="hint mt-2">
                {plural(draftQty, draft.unit)} × {conv} bottles = {plural(draftBase, 'bottle')} · {money(draftQty * draftCost)}
              </p>
            )}
          </div>

          {lines.length > 0 && (
            <div className="overflow-hidden rounded-[16px] border border-line-2">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Qty</th>
                      <th className="num">Cost/unit</th>
                      <th className="num">Subtotal</th>
                      <th className="num">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.name}</td>
                        <td className="num tnum">{plural(l.quantity, l.unit)}</td>
                        <td className="num tnum">{money(l.costPerUnit)}</td>
                        <td className="num tnum font-semibold">{money(l.quantity * l.costPerUnit)}</td>
                        <td className="num">
                          <IconButton size={30} icon={Trash2} label={`Remove ${l.name} line`} onClick={() => removeLine(i)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between border-t border-line-2 bg-surface-2 px-3.5 py-2.5 text-[13.5px] font-semibold">
                <span>Total</span>
                <span className="tnum">{money(grandTotal)}</span>
              </div>
            </div>
          )}

          <Field label="Notes" htmlFor="rs-notes">
            <Textarea id="rs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. invoice number" className="min-h-16" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
const ADJ_TYPES = [
  ['DAMAGED', 'Damaged', -1],
  ['LOST', 'Lost', -1],
  ['EXPIRED', 'Expired', -1],
  ['SUPPLIER_RETURN', 'Returned to supplier', -1],
  ['CORRECTION', 'Stock correction', 0],
  ['OTHER', 'Other', 0],
];

/** `initialQuantity`/`initialDirection`/`initialNotes` let a caller (e.g. resolving a physical
 * count difference) open this pre-filled as a CORRECTION instead of the DAMAGED default. */
export function AdjustModal({ open, onClose, onDone, variantId, initialQuantity, initialDirection, initialNotes }) {
  const data = useStockData(open, false);
  const toast = useToast();
  const [form, setForm] = useState({ variantId: '', type: 'DAMAGED', direction: 'remove', quantity: 1, unit: 'bottle', notes: '' });
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open || !data?.items.length) return;
    const first = data.items.find((i) => i.variantId === variantId) || data.items.find((i) => i.quantity > 0) || data.items[0];
    const prefilled = initialQuantity > 0;
    setForm({
      variantId: first.variantId,
      type: prefilled ? 'CORRECTION' : 'DAMAGED',
      direction: prefilled ? initialDirection : 'remove',
      quantity: prefilled ? initialQuantity : 1,
      unit: 'bottle',
      notes: initialNotes || '',
    });
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, variantId]);

  const v = data?.items.find((i) => i.variantId === form.variantId);
  const type = ADJ_TYPES.find((t) => t[0] === form.type);
  const remove = type[2] === -1 || form.direction === 'remove';
  const base = (Number(form.quantity) || 0) * (v ? conversionFor(v, form.unit) : 0);
  const delta = remove ? -base : base;
  const after = (v?.quantity || 0) + delta;
  const error = after < 0 ? `Stock can’t go below zero. Only ${plural(v.quantity, 'bottle')} in stock.` : '';
  const valid = v && base > 0 && !error && form.notes.trim().length >= 3;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const confirm = async () => {
    try {
      await inventoryService.adjust({ ...form, quantity: Number(form.quantity) });
      toast.success('Stock adjustment recorded.');
      onDone?.();
      onClose();
    } catch (err) {
      setServerError(err.message);
      throw err;
    }
  };

  return (
    <>
      <Modal
        open={open && !confirming}
        onClose={onClose}
        size="lg"
        title="Stock adjustment"
        description="For damaged, lost or expired stock and recount corrections."
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!valid} onClick={() => setConfirming(true)}>
              Review adjustment
            </Button>
          </>
        }
      >
        {!v ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <FormError message={serverError} />
            <Field label="Product" htmlFor="adj-variant">
              <Combobox id="adj-variant" value={form.variantId} onChange={(variantId) => set({ variantId, unit: 'bottle' })} options={variantOptions(data.items)} placeholder="Search products…" />
            </Field>
            <div>
              <div className="label mb-2">Reason</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ADJ_TYPES.map(([k, l, dir]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={form.type === k}
                    onClick={() => set({ type: k })}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold',
                      form.type === k ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface'
                    )}
                  >
                    {l}
                    <small className="block text-[12px] font-normal text-ink-3">{dir === -1 ? 'Removes stock' : 'Add or remove'}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {type[2] === 0 && (
                <Field label="Direction">
                  <div className="inline-flex gap-[3px] rounded-[11px] bg-surface-3 p-[3px]">
                    {['remove', 'add'].map((d) => (
                      <button key={d} type="button" onClick={() => set({ direction: d })} className={cn('h-9 flex-1 rounded-lg text-[13px] font-semibold capitalize', form.direction === d ? 'bg-surface shadow' : 'text-ink-2')}>
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Quantity" htmlFor="adj-qty">
                <input id="adj-qty" className="input" type="number" min="1" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} aria-invalid={error ? 'true' : undefined} />
              </Field>
              <Field label="Unit" htmlFor="adj-unit">
                <Select id="adj-unit" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
                  {availableUnits(v).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 px-4 py-3.5">
              <div className={cn('tnum text-[15px] font-semibold', delta < 0 ? 'text-bad' : 'text-ok')}>
                {delta < 0 ? '−' : '+'}
                {plural(base, 'bottle')} <span className="font-medium text-ink-3">· {type[1]}</span>
              </div>
              <FromTo before={v.quantity} after={after} afterLabel="After adjustment" />
              {error && <div className="text-[12.5px] font-semibold text-bad">{error}</div>}
            </div>
            <Field label="Notes (required)" htmlFor="adj-notes" hint="Every adjustment is saved with your name, the time and this note.">
              <Textarea id="adj-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. 3 bottles broken during unloading." className="min-h-16" />
            </Field>
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirm}
        title="Confirm stock adjustment"
        confirmLabel="Record adjustment"
        danger={delta < 0}
        icon={SlidersHorizontal}
      >
        {v && (
          <>
            <p>
              <b className="text-ink">{v.name}</b> goes from {plural(v.quantity, 'bottle')} to {plural(Math.max(0, after), 'bottle')}.
            </p>
            <p>This is recorded as {type[1].toLowerCase()} with your name and note, and can’t be edited later.</p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/** Create a stock transfer: pick two different shops, add one or more products from the source
 * shop's own stock (never a combined business-wide number), then move them atomically. */
export function TransferModal({ open, onClose, onDone }) {
  const { shops } = useAuth();
  const toast = useToast();
  const [fromShopId, setFromShopId] = useState('');
  const [toShopId, setToShopId] = useState('');
  const [sourceItems, setSourceItems] = useState(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState({ variantId: '', unit: 'bottle', quantity: 1 });
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromShopId(shops[0]?.id || '');
    setToShopId(shops[1]?.id || '');
    setNotes('');
    setLines([]);
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !fromShopId) {
      setSourceItems(null);
      return undefined;
    }
    let live = true;
    setLoadingSource(true);
    inventoryService
      .list({ shopId: fromShopId })
      .then((r) => {
        if (!live) return;
        setSourceItems(r.items);
        const first = r.items.find((i) => i.quantity > 0) || r.items[0];
        setDraft(first ? { variantId: first.variantId, unit: bigUnit(first), quantity: 1 } : { variantId: '', unit: 'bottle', quantity: 1 });
      })
      .finally(() => live && setLoadingSource(false));
    return () => {
      live = false;
    };
  }, [open, fromShopId]);

  const fromShop = shops.find((s) => s.id === fromShopId);
  const toShop = shops.find((s) => s.id === toShopId);
  const sameShop = Boolean(fromShopId && toShopId && fromShopId === toShopId);
  const v = sourceItems?.find((i) => i.variantId === draft.variantId);
  const conv = v ? conversionFor(v, draft.unit) : 0;
  const draftQty = Number(draft.quantity) || 0;
  const draftBase = draftQty * conv;
  const draftValid = Boolean(v && draftBase > 0 && draftBase <= v.quantity && !sameShop);

  const onDraftVariant = (id) => {
    const nv = sourceItems.find((i) => i.variantId === id);
    setDraft({ variantId: id, unit: bigUnit(nv), quantity: 1 });
  };

  const addLine = () => {
    if (!draftValid) return;
    setLines((ls) => [...ls, { variantId: draft.variantId, unit: draft.unit, quantity: draftQty, name: v.name, productName: v.productName }]);
  };
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!lines.length || sameShop) return;
    setSubmitting(true);
    setServerError('');
    try {
      await transferService.create({
        fromShopId,
        toShopId,
        items: lines.map(({ variantId, unit, quantity }) => ({ variantId, unit, quantity })),
        notes,
      });
      toast.success('Stock transferred successfully.');
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
      title="New Stock Transfer"
      description="Move inventory between your shops. Source stock decreases, destination stock increases — nothing is merged."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={ArrowLeftRight} onClick={submit} loading={submitting} disabled={!lines.length || sameShop}>
            Transfer Stock{lines.length ? ` · ${plural(lines.length, 'item')}` : ''}
          </Button>
        </>
      }
    >
      {shops.length < 2 ? (
        <FormError message="Add a second shop first — transfers move stock between two of your shops." />
      ) : (
        <div className="flex flex-col gap-3.5">
          <FormError message={serverError} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="From shop" htmlFor="tr-from">
              <Select id="tr-from" value={fromShopId} onChange={(e) => setFromShopId(e.target.value)}>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To shop" htmlFor="tr-to" error={sameShop ? 'Must be different from the source shop' : undefined}>
              <Select id="tr-to" value={toShopId} onChange={(e) => setToShopId(e.target.value)}>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="rounded-[16px] border border-line-2 bg-surface-2 p-3.5">
            <div className="label mb-2">Add to this transfer</div>
            {loadingSource ? (
              <Skeleton className="h-10" />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.6fr)_84px_112px_auto]">
                <Field label="Product" htmlFor="tr-variant">
                  <Combobox id="tr-variant" value={draft.variantId} onChange={onDraftVariant} options={variantOptions(sourceItems || [])} placeholder="Search products…" />
                </Field>
                <Field label="Qty" htmlFor="tr-qty">
                  <input
                    id="tr-qty"
                    className="input"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  />
                </Field>
                <Field label="Unit" htmlFor="tr-unit">
                  <Select id="tr-unit" value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}>
                    {v &&
                      availableUnits(v).map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABEL[u]}
                        </option>
                      ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button type="button" variant="primary" icon={Plus} disabled={!draftValid} onClick={addLine} className="w-full sm:w-auto">
                    Add
                  </Button>
                </div>
              </div>
            )}
            {v && (
              <p className={cn('hint mt-2', draftBase > v.quantity && 'font-semibold text-bad')}>
                Available at {fromShop?.name}: {describeStock(v)}
                {draftBase > 0 && ` · ${plural(draftQty, draft.unit)} = ${plural(draftBase, 'bottle')}`}
                {draftBase > v.quantity && ' · Not enough stock'}
              </p>
            )}
            {sourceItems && !sourceItems.length && <p className="hint mt-2">{fromShop?.name} has no stock to transfer yet.</p>}
          </div>

          {lines.length > 0 && (
            <div className="overflow-hidden rounded-[16px] border border-line-2">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Quantity</th>
                      <th className="num">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.name}</td>
                        <td className="num tnum">{plural(l.quantity, l.unit)}</td>
                        <td className="num">
                          <IconButton size={30} icon={Trash2} label={`Remove ${l.name} line`} onClick={() => removeLine(i)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fromShop && toShop && (
                <div className="flex items-center justify-center gap-2.5 border-t border-line-2 bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-ink-2">
                  {fromShop.name} <ArrowRight size={15} className="text-ink-3" /> {toShop.name}
                </div>
              )}
            </div>
          )}

          <Field label="Notes" htmlFor="tr-notes">
            <Textarea id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="min-h-16" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
