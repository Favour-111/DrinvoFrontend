import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2, Undo2 } from '../icons.js';
import { Modal } from '../ui/Modal.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Field, FormError, Input, Textarea } from '../ui/Form.jsx';
import { Combobox } from '../ui/Combobox.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { inventoryService, borrowingService } from '../../services/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { plural, isoDate } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const variantOptions = (items) => items.map((v) => ({ value: v.variantId, label: v.name, group: v.productName, sublabel: describeStock(v) }));

/** Inline per-unit entry for one product — the same "4 cartons + 5 bottles in one go" pattern as
 * the physical count screen, since a borrowing line can only appear once per product. */
function UnitEntry({ product, qty, onChange }) {
  const units = availableUnits(product);
  const total = units.reduce((s, u) => s + (Number(qty[u]) || 0) * conversionFor(product, u), 0);
  return (
    <div className="flex flex-col gap-2">
      <div className={cn('grid gap-2', units.length === 1 ? 'grid-cols-1' : units.length === 2 ? 'grid-cols-2' : 'grid-cols-4')}>
        {units.map((u) => (
          <label key={u} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-3">{UNIT_LABEL[u]}</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="0"
              value={qty[u] ?? ''}
              onChange={(e) => onChange(u, e.target.value)}
              className="input h-9 text-center text-[13px]"
              aria-label={`${UNIT_LABEL[u]} for ${product.name}`}
            />
          </label>
        ))}
      </div>
      {total > 0 && <p className="hint">= {plural(total, 'bottle')}</p>}
    </div>
  );
}

function countsFrom(product, qty) {
  return availableUnits(product)
    .filter((u) => Number(qty[u]) > 0)
    .map((u) => ({ unit: u, quantity: Number(qty[u]) }));
}
function totalBase(product, counts) {
  return counts.reduce((s, c) => s + c.quantity * conversionFor(product, c.unit), 0);
}

/** Record drinks lent out to, or borrowed in from, someone outside the business — never one of
 * our own shops (that's a Stock Transfer). Moves inventory immediately; never a sale. */
export function BorrowModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [direction, setDirection] = useState('LENT');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);
  const [draftVariantId, setDraftVariantId] = useState('');
  const [draftQty, setDraftQty] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection('LENT');
    setCounterpartyName('');
    setCounterpartyPhone('');
    setExpectedReturnDate('');
    setNotes('');
    setLines([]);
    setDraftVariantId('');
    setDraftQty({});
    setServerError('');
    inventoryService.list().then((r) => setItems(r.items));
  }, [open]);

  const draftProduct = items?.find((p) => p.variantId === draftVariantId);
  const draftCounts = draftProduct ? countsFrom(draftProduct, draftQty) : [];
  const draftTotal = draftProduct ? totalBase(draftProduct, draftCounts) : 0;
  const alreadyAdded = lines.some((l) => l.variantId === draftVariantId);

  const addLine = () => {
    if (!draftProduct || !draftCounts.length || alreadyAdded) return;
    setLines((ls) => [...ls, { variantId: draftProduct.variantId, name: draftProduct.name, product: draftProduct, counts: draftCounts, total: draftTotal }]);
    setDraftVariantId('');
    setDraftQty({});
  };
  const removeLine = (variantId) => setLines((ls) => ls.filter((l) => l.variantId !== variantId));

  const valid = lines.length > 0 && counterpartyName.trim().length >= 2;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setServerError('');
    try {
      await borrowingService.create({
        direction,
        counterpartyName: counterpartyName.trim(),
        counterpartyPhone: counterpartyPhone.trim(),
        items: lines.map(({ variantId, counts }) => ({ variantId, counts })),
        ...(expectedReturnDate ? { expectedReturnDate: new Date(`${expectedReturnDate}T12:00:00`).toISOString() } : {}),
        notes,
      });
      toast.success(direction === 'LENT' ? 'Lending recorded.' : 'Borrowing recorded.');
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
      title="Borrowed Drinks"
      description="For drinks borrowed to or from someone outside the business. Stock moves now; this is never a sale."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} loading={submitting} disabled={!valid}>
            Record {direction === 'LENT' ? 'Lending' : 'Borrowing'}{lines.length ? ` · ${plural(lines.length, 'item')}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={serverError} />

        <div>
          <div className="label mb-1.5">Direction</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['LENT', 'They borrowed from us', 'Our stock goes out'],
              ['BORROWED', 'We borrowed from them', 'Our stock comes in'],
            ].map(([k, l, hint]) => (
              <button
                key={k}
                type="button"
                aria-pressed={direction === k}
                onClick={() => setDirection(k)}
                className={cn('rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold', direction === k ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface')}
              >
                {l}
                <small className="block text-[12px] font-normal text-ink-3">{hint}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={direction === 'LENT' ? 'Borrowed by' : 'Borrowed from'} htmlFor="brw-name">
            <Input id="brw-name" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="e.g. Chidi's Bar" autoComplete="off" />
          </Field>
          <Field label="Their phone (optional)" htmlFor="brw-phone">
            <Input id="brw-phone" type="tel" value={counterpartyPhone} onChange={(e) => setCounterpartyPhone(e.target.value)} autoComplete="off" />
          </Field>
        </div>

        <div className="rounded-[16px] border border-line-2 bg-surface-2 p-3.5">
          <div className="label mb-2">Add a product</div>
          {!items ? (
            <Skeleton className="h-10" />
          ) : (
            <div className="flex flex-col gap-2.5">
              <Combobox
                id="brw-variant"
                value={draftVariantId}
                onChange={(id) => {
                  setDraftVariantId(id);
                  setDraftQty({});
                }}
                options={variantOptions(items)}
                placeholder="Search products…"
              />
              {draftProduct && (
                <>
                  {alreadyAdded && <p className="text-[12.5px] font-medium text-bad">Already added — remove it below first to change the quantity.</p>}
                  <UnitEntry product={draftProduct} qty={draftQty} onChange={(u, v) => setDraftQty((q) => ({ ...q, [u]: v }))} />
                  <Button type="button" variant="primary" icon={Plus} disabled={!draftCounts.length || alreadyAdded} onClick={addLine} className="self-start">
                    Add
                  </Button>
                </>
              )}
            </div>
          )}
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
                  {lines.map((l) => (
                    <tr key={l.variantId}>
                      <td>{l.name}</td>
                      <td className="num tnum">{l.counts.map((c) => `${c.quantity} ${UNIT_LABEL[c.unit]}${c.quantity === 1 ? '' : 's'}`).join(' + ')}</td>
                      <td className="num">
                        <IconButton size={30} icon={Trash2} label={`Remove ${l.name} line`} onClick={() => removeLine(l.variantId)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Expected return date (optional)" htmlFor="brw-date">
            <input id="brw-date" type="date" className="input" min={isoDate()} value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="brw-notes">
            <Textarea id="brw-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="min-h-[42px]" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** Return some or all of what's outstanding on a borrowing record. Can be used more than once —
 * each call only has to account for what's returned this time. */
export function ReturnBorrowingModal({ open, onClose, onDone, borrowing }) {
  const toast = useToast();
  const [qty, setQty] = useState({}); // { variantId: { unit: value } }
  const [notes, setNotes] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQty({});
      setNotes('');
      setServerError('');
    }
  }, [open]);

  // Hooks must run unconditionally (before any early return), so the "no borrowing yet" case is
  // handled inside the memo itself rather than bailing out above it.
  const outstanding = borrowing ? borrowing.items.filter((i) => i.remainingBaseQuantity > 0) : [];
  const lines = useMemo(
    () =>
      outstanding
        .map((item) => {
          const counts = (item.countedUnits || []).map((c) => c.unit).reduce((acc, u) => (acc.includes(u) ? acc : [...acc, u]), []);
          const q = qty[item.variantId] || {};
          const entries = counts
            .map((u) => {
              const conv = item.countedUnits.find((c) => c.unit === u)?.conversion || 1;
              return { unit: u, conv, value: Number(q[u]) || 0 };
            })
            .filter((e) => e.value > 0);
          const total = entries.reduce((s, e) => s + e.value * e.conv, 0);
          return { item, entries, total };
        })
        .filter((l) => l.total > 0),
    [qty, outstanding]
  );

  if (!borrowing) return null;
  const errors = lines.filter((l) => l.total > l.item.remainingBaseQuantity);
  const valid = lines.length > 0 && errors.length === 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setServerError('');
    try {
      await borrowingService.return(borrowing.id, {
        items: lines.map((l) => ({ variantId: l.item.variantId, counts: l.entries.map((e) => ({ unit: e.unit, quantity: e.value })) })),
        notes,
      });
      toast.success('Return recorded.');
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
      title={`Return — ${borrowing.borrowNumber}`}
      description={borrowing.direction === 'LENT' ? `What ${borrowing.counterpartyName} is giving back.` : `What we're giving back to ${borrowing.counterpartyName}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Undo2} onClick={submit} loading={submitting} disabled={!valid}>
            Record Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={serverError} />
        {outstanding.length ? (
          outstanding.map((item) => {
            const units = [...new Set(item.countedUnits.map((c) => c.unit))];
            const line = lines.find((l) => l.item.variantId === item.variantId);
            const over = line && line.total > item.remainingBaseQuantity;
            return (
              <div key={item.variantId} className={cn('rounded-[14px] border p-3', over ? 'border-bad/40 bg-bad-soft' : 'border-line-2 bg-surface-2')}>
                <div className="mb-2 flex items-center justify-between">
                  <b className="text-[13.5px] font-semibold">{item.name}</b>
                  <span className="text-[12px] text-ink-3">{plural(item.remainingBaseQuantity, 'bottle')} outstanding</span>
                </div>
                <div className={cn('grid gap-2', units.length === 1 ? 'grid-cols-2' : 'grid-cols-3')}>
                  {units.map((u) => (
                    <label key={u} className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-ink-3">{UNIT_LABEL[u]}</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="0"
                        value={qty[item.variantId]?.[u] ?? ''}
                        onChange={(e) => setQty((q) => ({ ...q, [item.variantId]: { ...q[item.variantId], [u]: e.target.value } }))}
                        className="input h-9 text-center text-[13px]"
                        aria-label={`${UNIT_LABEL[u]} returned for ${item.name}`}
                      />
                    </label>
                  ))}
                </div>
                {over && <p className="mt-1.5 text-[12px] font-semibold text-bad">More than what's outstanding.</p>}
              </div>
            );
          })
        ) : (
          <p className="hint">Nothing outstanding on this record.</p>
        )}
        <Field label="Notes" htmlFor="rtn-notes">
          <Textarea id="rtn-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="min-h-16" />
        </Field>
      </div>
    </Modal>
  );
}
