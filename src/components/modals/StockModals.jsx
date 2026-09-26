import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, SlidersHorizontal } from '../icons.js';
import { Modal, ConfirmDialog } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, FormError, FormField, MoneyInput, Select, Textarea } from '../ui/Form.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { inventoryService, supplierService } from '../../services/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { money, plural } from '../../utils/format.js';
import { availableUnits, bigUnit, conversionFor, describeStock, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

function VariantOptions({ items }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const i of items) {
      if (!map.has(i.productName)) map.set(i.productName, []);
      map.get(i.productName).push(i);
    }
    return [...map.entries()];
  }, [items]);
  return groups.map(([name, vs]) => (
    <optgroup key={name} label={name}>
      {vs.map((v) => (
        <option key={v.variantId} value={v.variantId}>
          {v.name} · {describeStock(v)}
        </option>
      ))}
    </optgroup>
  ));
}

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
const restockSchema = z.object({
  supplierId: z.string().min(1, 'Choose a supplier'),
  variantId: z.string().min(1, 'Choose a product'),
  quantity: z.coerce.number().int('Use a whole number').min(1, 'Enter at least 1'),
  unit: z.string(),
  costPerUnit: z.coerce.number().positive('Enter the cost'),
  notes: z.string().max(1000).optional(),
});

export function RestockModal({ open, onClose, onDone, variantId, supplierId }) {
  const data = useStockData(open, true);
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, setValue, reset, formState } = useForm({ resolver: zodResolver(restockSchema) });

  useEffect(() => {
    if (!open || !data) return;
    const first = data.items.find((i) => i.variantId === variantId) || [...data.items].sort((a, b) => a.quantity / (a.lowStockThreshold || 1) - b.quantity / (b.lowStockThreshold || 1))[0];
    if (!first) return;
    const u = bigUnit(first);
    reset({ supplierId: supplierId || data.suppliers[0]?.id || '', variantId: first.variantId, quantity: 10, unit: u, costPerUnit: Math.round(first.avgCost * conversionFor(first, u)), notes: '' });
    setServerError('');
  }, [open, data, variantId, supplierId, reset]);

  const values = watch();
  const v = data?.items.find((i) => i.variantId === values.variantId);
  const conv = v ? conversionFor(v, values.unit) : 0;
  const qty = Number(values.quantity) || 0;
  const base = qty * conv;
  const total = qty * (Number(values.costPerUnit) || 0);
  const newAvg = v && base ? (v.quantity * v.avgCost + total) / (v.quantity + base) : v?.avgCost;

  const onVariant = (id) => {
    const nv = data.items.find((i) => i.variantId === id);
    const u = bigUnit(nv);
    setValue('variantId', id);
    setValue('unit', u);
    setValue('costPerUnit', Math.round(nv.avgCost * conversionFor(nv, u)));
  };
  const onUnit = (u) => {
    setValue('unit', u);
    setValue('costPerUnit', Math.round(v.avgCost * conversionFor(v, u)));
  };

  const submit = handleSubmit(async (f) => {
    setServerError('');
    try {
      await inventoryService.restock({ supplierId: f.supplierId, notes: f.notes, items: [{ variantId: f.variantId, unit: f.unit, quantity: f.quantity, costPerUnit: f.costPerUnit }] });
      toast.success('Inventory restocked successfully.');
      onDone?.();
      onClose();
    } catch (err) {
      setServerError(err.message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Restock"
      description="Adds stock and records the purchase and a restock movement."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} loading={formState.isSubmitting} disabled={!v}>
            Confirm Restock
          </Button>
        </>
      }
    >
      {!data ? (
        <Skeleton className="h-64" />
      ) : !data.suppliers.length ? (
        <FormError message="Add a supplier first. Every restock is recorded against the supplier it came from." />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <FormError message={serverError} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Supplier" name="supplierId" as="select" register={register} errors={formState.errors}>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </FormField>
            <Field label="Product" htmlFor="rs-variant" error={formState.errors.variantId?.message}>
              <Select id="rs-variant" value={values.variantId || ''} onChange={(e) => onVariant(e.target.value)}>
                <VariantOptions items={data.items} />
              </Select>
            </Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <FormField label="Quantity" name="quantity" type="number" min="1" inputMode="numeric" register={register} errors={formState.errors} />
            <Field label="Unit" htmlFor="rs-unit">
              <Select id="rs-unit" value={values.unit || ''} onChange={(e) => onUnit(e.target.value)}>
                {v &&
                  availableUnits(v).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
              </Select>
            </Field>
            <FormField label={`Cost per ${values.unit || 'unit'}`} name="costPerUnit" as="money" register={register} errors={formState.errors} />
          </div>
          {v && (
            <div className="flex flex-col gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 px-4 py-3.5">
              <div className="tnum text-[15px] font-semibold">
                {plural(qty, values.unit)} <span className="font-medium text-ink-3">×</span> {conv} bottles <span className="font-medium text-ink-3">=</span> {plural(base, 'bottle')}
              </div>
              <FromTo before={v.quantity} after={v.quantity + base} variant={v} afterLabel="After restock" />
              <div className="flex flex-wrap justify-between gap-2 text-[13.5px]">
                <span className="text-ink-3">Total cost</span>
                <b className="tnum">{money(total)}</b>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-[13.5px]">
                <span className="text-ink-3">Average cost per bottle</span>
                <b className="tnum">
                  {money(v.avgCost)} → {money(newAvg)}
                </b>
              </div>
            </div>
          )}
          <FormField label="Notes" name="notes" as="textarea" placeholder="Optional, e.g. invoice number" register={register} errors={formState.errors} className="[&_textarea]:min-h-16" />
        </form>
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

export function AdjustModal({ open, onClose, onDone, variantId }) {
  const data = useStockData(open, false);
  const toast = useToast();
  const [form, setForm] = useState({ variantId: '', type: 'DAMAGED', direction: 'remove', quantity: 1, unit: 'bottle', notes: '' });
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open || !data?.items.length) return;
    const first = data.items.find((i) => i.variantId === variantId) || data.items.find((i) => i.quantity > 0) || data.items[0];
    setForm({ variantId: first.variantId, type: 'DAMAGED', direction: 'remove', quantity: 1, unit: 'bottle', notes: '' });
    setServerError('');
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
              <Select id="adj-variant" value={form.variantId} onChange={(e) => set({ variantId: e.target.value, unit: 'bottle' })}>
                <VariantOptions items={data.items} />
              </Select>
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
