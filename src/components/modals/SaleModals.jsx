import { useEffect, useState } from 'react';
import { Ban, Wallet } from '../icons.js';
import { Modal, ConfirmDialog } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, FormError, Input, MoneyInput, Select, Stepper, Switch, Textarea } from '../ui/Form.jsx';
import { ProductThumb } from '../ui/Media.jsx';
import { salesService } from '../../services/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { money, plural } from '../../utils/format.js';

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
      title="Process return"
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
        title="Refund"
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
      title={`Void ${sale.receiptNumber}?`}
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
