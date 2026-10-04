import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, ShoppingCart, PackageSearch } from '../icons.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, FormError, Input, Select, Switch, Textarea } from '../ui/Form.jsx';
import { Combobox } from '../ui/Combobox.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { productService, onDemandPurchaseService } from '../../services/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { describeStock, UNIT_LABEL, UNITS } from '../../utils/units.js';
import { money } from '../../utils/format.js';

const variantOptions = (items) =>
  items.map((v) => ({ value: v.variantId, label: v.name, group: v.productName, sublabel: v.quantity > 0 ? describeStock(v) : 'Not stocked here' }));

/**
 * Step 1: record that a customer asked for something this shop doesn't have. Nothing is spent or
 * stocked yet — that's step 2 (MarkPurchasedModal), once the actual buy happens.
 */
export function RequestOnDemandModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', brand: '', category: '', size: '', sellingPrice: '' });
  const [requestedQuantity, setRequestedQuantity] = useState('1');
  const [unit, setUnit] = useState('bottle');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [purchasedFromPhone, setPurchasedFromPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAddingNew(false);
    setVariantId('');
    setNewProduct({ name: '', brand: '', category: '', size: '', sellingPrice: '' });
    setRequestedQuantity('1');
    setUnit('bottle');
    setPurchasedFrom('');
    setPurchasedFromPhone('');
    setCustomerName('');
    setSellingPricePerUnit('');
    setNotes('');
    setServerError('');
    productService.list().then((r) => setItems(r.items));
  }, [open]);

  const valid =
    Number(requestedQuantity) > 0 &&
    purchasedFrom.trim().length >= 2 &&
    (addingNew
      ? newProduct.name.trim() && newProduct.category.trim() && newProduct.size.trim() && Number(newProduct.sellingPrice) > 0
      : Boolean(variantId));

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setServerError('');
    try {
      await onDemandPurchaseService.create({
        ...(addingNew
          ? { newProduct: { ...newProduct, sellingPrice: Number(newProduct.sellingPrice) } }
          : { variantId }),
        requestedQuantity: Number(requestedQuantity),
        unit,
        purchasedFrom: purchasedFrom.trim(),
        purchasedFromPhone: purchasedFromPhone.trim(),
        customerName: customerName.trim(),
        ...(sellingPricePerUnit ? { sellingPricePerUnit: Number(sellingPricePerUnit) } : {}),
        notes,
      });
      toast.success('Request recorded — mark it as purchased once you’ve bought it.');
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
      title="On-Demand Purchase" icon={PackageSearch} tone="brand"
      description="For a customer request this shop doesn't normally stock — buy it in specifically, then sell it to them."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={submit} loading={submitting} disabled={!valid}>
            Record Request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={serverError} />

        <div>
          <div className="label mb-1.5">What the customer wants</div>
          {!items ? (
            <Skeleton className="h-10" />
          ) : addingNew ? (
            <div className="rounded-[14px] border border-line-2 bg-surface-2 p-3 flex flex-col gap-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Product name" htmlFor="odp-name">
                  <Input id="odp-name" value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Guinness Smooth" />
                </Field>
                <Field label="Brand (optional)" htmlFor="odp-brand">
                  <Input id="odp-brand" value={newProduct.brand} onChange={(e) => setNewProduct((p) => ({ ...p, brand: e.target.value }))} />
                </Field>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Field label="Category" htmlFor="odp-category">
                  <Input id="odp-category" list="odp-categories" value={newProduct.category} onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Beer" />
                  <datalist id="odp-categories">
                    {[...new Set(items.map((i) => i.category))].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Size" htmlFor="odp-size">
                  <Input id="odp-size" value={newProduct.size} onChange={(e) => setNewProduct((p) => ({ ...p, size: e.target.value }))} placeholder="e.g. 60cl" />
                </Field>
                <Field label="Selling price" htmlFor="odp-price">
                  <Input id="odp-price" type="number" min="0" value={newProduct.sellingPrice} onChange={(e) => setNewProduct((p) => ({ ...p, sellingPrice: e.target.value }))} placeholder="₦" />
                </Field>
              </div>
              <Button type="button" size="sm" onClick={() => setAddingNew(false)} className="self-start">
                Search existing products instead
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Combobox id="odp-variant" value={variantId} onChange={setVariantId} options={variantOptions(items)} placeholder="Search products…" />
              <Button type="button" size="sm" icon={Plus} onClick={() => setAddingNew(true)} className="self-start">
                Can't find it? Add a new product
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Quantity" htmlFor="odp-qty">
            <Input id="odp-qty" type="number" min="1" value={requestedQuantity} onChange={(e) => setRequestedQuantity(e.target.value)} />
          </Field>
          <Field label="Unit" htmlFor="odp-unit">
            <Select id="odp-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sell at (optional)" htmlFor="odp-sell">
            <Input id="odp-sell" type="number" min="0" value={sellingPricePerUnit} onChange={(e) => setSellingPricePerUnit(e.target.value)} placeholder="Per unit" />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Buying from" htmlFor="odp-from">
            <Input id="odp-from" value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} placeholder="e.g. Chidi's Bar" autoComplete="off" />
          </Field>
          <Field label="Their phone (optional)" htmlFor="odp-from-phone">
            <Input id="odp-from-phone" type="tel" value={purchasedFromPhone} onChange={(e) => setPurchasedFromPhone(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Customer (optional)" htmlFor="odp-customer">
            <Input id="odp-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Who asked for this" />
          </Field>
          <Field label="Notes" htmlFor="odp-notes">
            <Textarea id="odp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="min-h-[42px]" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Step 2: the purchase actually happened. Adds the real stock to this shop at its real cost, and
 * can hand straight into a normal sale so staff don't have to search for it again at checkout.
 */
export function MarkPurchasedModal({ open, onClose, onDone, odp, canSell }) {
  const toast = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('bottle');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState('');
  const [sellNow, setSellNow] = useState(true);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !odp) return;
    setQuantity(String(odp.requestedQuantity || 1));
    setUnit(odp.unit || 'bottle');
    setUnitCost('');
    setSellingPricePerUnit(odp.sellingPricePerUnit ? String(odp.sellingPricePerUnit) : '');
    setSellNow(canSell);
    setServerError('');
  }, [open, odp, canSell]);

  if (!odp) return null;
  const valid = Number(quantity) > 0 && Number(unitCost) > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setServerError('');
    try {
      const result = await onDemandPurchaseService.markPurchased(odp.id, {
        quantity: Number(quantity),
        unit,
        unitCost: Number(unitCost),
        ...(sellingPricePerUnit ? { sellingPricePerUnit: Number(sellingPricePerUnit) } : {}),
      });
      toast.success('Purchase recorded — stock is in.');
      if (sellNow && canSell && result.cartProduct) {
        cart.addLine(result.cartProduct, { unit, quantity: Number(quantity), priceOverride: sellingPricePerUnit ? Number(sellingPricePerUnit) : undefined });
        onDone?.();
        onClose();
        navigate('/staff/sale');
        return;
      }
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
      size="md"
      title={`Mark Purchased — ${odp.odpNumber}`} icon={Check} tone="brand"
      description={`What you actually bought for ${odp.name}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={sellNow && canSell ? ShoppingCart : Check} onClick={submit} loading={submitting} disabled={!valid}>
            {sellNow && canSell ? 'Confirm & Add to Sale' : 'Confirm Purchase'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={serverError} />
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Quantity" htmlFor="odpp-qty">
            <Input id="odpp-qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit" htmlFor="odpp-unit">
            <Select id="odpp-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Cost per ${UNIT_LABEL[unit].toLowerCase()}`} htmlFor="odpp-cost">
            <Input id="odpp-cost" type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="₦" />
          </Field>
        </div>
        {Number(quantity) > 0 && Number(unitCost) > 0 && <p className="hint">Total spent: {money(Number(quantity) * Number(unitCost))}</p>}
        <Field label="Suggested selling price (optional)" htmlFor="odpp-sell">
          <Input id="odpp-sell" type="number" min="0" value={sellingPricePerUnit} onChange={(e) => setSellingPricePerUnit(e.target.value)} placeholder={`Per ${UNIT_LABEL[unit].toLowerCase()}`} />
        </Field>
        {canSell && (
          <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
            <span>Add straight to a sale for this customer</span>
            <Switch checked={sellNow} onChange={setSellNow} label="Add straight to a sale for this customer" />
          </label>
        )}
      </div>
    </Modal>
  );
}
