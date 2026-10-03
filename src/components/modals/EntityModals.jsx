import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Plus, ShieldCheck, Trash2 } from '../icons.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { DetailList } from '../ui/Card.jsx';
import { Field, FormError, FormField, Input } from '../ui/Form.jsx';
import { customerService, settingsService, staffService, supplierService } from '../../services/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { money } from '../../utils/format.js';

/** Maps server field errors onto the form. */
function applyServerErrors(err, setError) {
  if (err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k, { message });
}

function useEntityForm(schema, defaults, open) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const [serverError, setServerError] = useState('');
  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { ...form, serverError, setServerError };
}

const phone = z.string().trim().min(7, 'Enter a valid phone number');

/* ---------- supplier ---------- */
const supplierContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
});
const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Enter a supplier name'),
  contacts: z.array(supplierContactSchema).min(1, 'Add at least one contact person'),
  address: z.string().trim().optional(),
});
const emptyContact = { name: '', phone: '', email: '' };

export function SupplierModal({ open, onClose, supplier, onDone }) {
  const toast = useToast();
  const edit = Boolean(supplier);
  const defaults = {
    name: supplier?.name || '',
    contacts: supplier?.contacts?.length ? supplier.contacts.map((c) => ({ name: c.name || '', phone: c.phone || '', email: c.email || '' })) : [emptyContact],
    address: supplier?.address || '',
  };
  const f = useEntityForm(supplierSchema, defaults, open);
  const { fields, append, remove } = useFieldArray({ control: f.control, name: 'contacts' });
  const submit = f.handleSubmit(async (values) => {
    try {
      const res = edit ? await supplierService.update(supplier.id, values) : await supplierService.create(values);
      toast.success(edit ? 'Supplier updated.' : 'Supplier added.');
      onDone?.(res);
      onClose();
    } catch (err) {
      applyServerErrors(err, f.setError);
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit supplier' : 'Add Supplier'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            {edit ? 'Save changes' : 'Add Supplier'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <FormField label="Name" name="name" register={f.register} errors={f.formState.errors} placeholder="e.g. ABC Beverages Ltd" />
        <div>
          <div className="label mb-1.5">Contact people</div>
          <div className="flex flex-col gap-2.5">
            {fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-2 rounded-[14px] border border-line-2 bg-surface-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-3">Contact {i + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" aria-label={`Remove contact ${i + 1}`} onClick={() => remove(i)} className="flex items-center gap-1 text-[12px] font-semibold text-bad">
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <FormField label="Name" name={`contacts.${i}.name`} register={f.register} errors={f.formState.errors} />
                  <FormField label="Phone" name={`contacts.${i}.phone`} type="tel" register={f.register} errors={f.formState.errors} />
                  <FormField label="Email" name={`contacts.${i}.email`} type="email" register={f.register} errors={f.formState.errors} />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" icon={Plus} className="mt-2.5" onClick={() => append(emptyContact)}>
            Add another contact
          </Button>
        </div>
        <FormField label="Address" name="address" register={f.register} errors={f.formState.errors} />
      </form>
    </Modal>
  );
}

/** Strong confirmation before a destructive action: the Delete button only enables once the
 * admin has typed the supplier's name exactly, so a stray click can't delete the wrong one. */
export function DeleteSupplierModal({ open, onClose, supplier, onDone }) {
  const toast = useToast();
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setConfirmName('');
      setError('');
    }
  }, [open]);

  if (!supplier) return null;
  const matches = confirmName.trim().length > 0 && confirmName.trim() === supplier.name;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await supplierService.delete(supplier.id, confirmName.trim());
      toast.success('Supplier deleted.');
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
      onClose={busy ? undefined : onClose}
      size="sm"
      title={`Delete ${supplier.name}?`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={run} loading={busy} disabled={!matches}>
            Delete Supplier
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormError message={error} />
        <div className="flex gap-3.5">
          <span className="grid size-[42px] flex-none place-items-center rounded-[12px] bg-bad-soft text-bad">
            <AlertTriangle size={21} />
          </span>
          <div className="flex flex-col gap-2 text-[14px] text-ink-2">
            <p>
              This can’t be easily undone. <b className="text-ink">{supplier.name}</b> will disappear from every product and restock picker, and from your active suppliers list.
            </p>
            <p>Past purchases and restock history from this supplier are kept for your records — nothing breaks, it just won’t show up as an active supplier anymore.</p>
          </div>
        </div>
        <Field label={<span>Type <b className="text-ink">{supplier.name}</b> to confirm</span>} htmlFor="del-sup-confirm">
          <Input id="del-sup-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" placeholder={supplier.name} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- customer ---------- */
const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  businessName: z.string().trim().optional(),
  phone,
  address: z.string().trim().optional(),
});

export function CustomerModal({ open, onClose, customer, onDone }) {
  const toast = useToast();
  const edit = Boolean(customer);
  const f = useEntityForm(customerSchema, { name: customer?.name || '', businessName: customer?.businessName || '', phone: customer?.phone || '', address: customer?.address || '' }, open);
  const submit = f.handleSubmit(async (values) => {
    try {
      const res = edit ? await customerService.update(customer.id, values) : await customerService.create(values);
      toast.success(edit ? 'Customer updated.' : 'Customer added.');
      onDone?.(res);
      onClose();
    } catch (err) {
      applyServerErrors(err, f.setError);
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit customer' : 'Add Customer'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            {edit ? 'Save changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Name" name="name" register={f.register} errors={f.formState.errors} />
          <FormField label="Business (optional)" name="businessName" register={f.register} errors={f.formState.errors} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Phone" name="phone" type="tel" register={f.register} errors={f.formState.errors} />
          <FormField label="Address" name="address" register={f.register} errors={f.formState.errors} />
        </div>
      </form>
    </Modal>
  );
}

/* ---------- credit payment ---------- */
export function PaymentModal({ open, onClose, customer, onDone }) {
  const toast = useToast();
  const schema = z.object({
    amount: z.coerce.number().positive('Enter an amount').max(customer.outstanding, `That’s more than the ${money(customer.outstanding)} owed.`),
    method: z.enum(['CASH', 'POS', 'TRANSFER']),
    note: z.string().max(300).optional(),
  });
  const f = useEntityForm(schema, { amount: '', method: 'CASH', note: '' }, open);
  const amount = Number(f.watch('amount')) || 0;
  const submit = f.handleSubmit(async (values) => {
    try {
      await customerService.recordPayment({ customerId: customer.id, ...values });
      toast.success('Payment recorded.');
      onDone?.();
      onClose();
    } catch (err) {
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Record Payment"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            Record {amount > 0 ? money(amount) : 'payment'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <div className="rounded-[16px] border border-line-2 bg-surface-2 px-4 py-3.5">
          <DetailList rows={[['Customer', customer.name], ['Outstanding', money(customer.outstanding)]]} />
        </div>
        <FormField label="Amount received" name="amount" as="money" register={f.register} errors={f.formState.errors} hint={`Balance after: ${money(Math.max(0, customer.outstanding - amount))}`} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Method" name="method" as="select" register={f.register} errors={f.formState.errors}>
            <option value="CASH">Cash</option>
            <option value="POS">POS</option>
            <option value="TRANSFER">Transfer</option>
          </FormField>
          <FormField label="Note" name="note" register={f.register} errors={f.formState.errors} placeholder="Optional" />
        </div>
      </form>
    </Modal>
  );
}

/* ---------- staff ---------- */
export function StaffModal({ open, onClose, member, onDone }) {
  const toast = useToast();
  const { shop, shops } = useAuth();
  const edit = Boolean(member);
  const schema = z.object({
    name: z.string().trim().min(2, 'Enter a name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().optional(),
    password: edit ? z.string().optional() : z.string().min(8, 'Use at least 8 characters'),
    role: z.enum(['STAFF', 'ADMIN']),
    shopId: z.string().min(1, 'Choose a shop'),
  });
  const f = useEntityForm(
    schema,
    { name: member?.name || '', email: member?.email || '', phone: member?.phone || '', password: '', role: member?.role || 'STAFF', shopId: member?.shopIds?.[0] || shop?.id || '' },
    open
  );
  const role = f.watch('role');
  const submit = f.handleSubmit(async ({ password, shopId, ...values }) => {
    try {
      const body = { ...values, shopIds: [shopId] };
      const res = edit ? await staffService.update(member.id, body) : await staffService.create({ ...body, password });
      toast.success(edit ? 'Staff details saved.' : 'Staff account created.');
      onDone?.(res);
      onClose();
    } catch (err) {
      applyServerErrors(err, f.setError);
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit staff' : 'Add Staff'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            {edit ? 'Save changes' : 'Add Staff'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Full name" name="name" register={f.register} errors={f.formState.errors} />
          <FormField label="Phone" name="phone" type="tel" register={f.register} errors={f.formState.errors} />
        </div>
        <FormField label="Email" name="email" type="email" autoComplete="off" register={f.register} errors={f.formState.errors} />
        {!edit && <FormField label="Temporary password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters. They can change it after signing in." register={f.register} errors={f.formState.errors} />}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Role" name="role" as="select" register={f.register} errors={f.formState.errors}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </FormField>
          <FormField label="Assigned shop" name="shopId" as="select" register={f.register} errors={f.formState.errors}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FormField>
        </div>
        <div className="flex gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
          <ShieldCheck size={16} className="mt-px flex-none text-ink-3" />
          <span>
            {role === 'ADMIN'
              ? 'Admins can see cost, profit and every setting.'
              : 'Staff can record sales, see their own sales and view stock. They cannot see cost price or profit.'}
          </span>
        </div>
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({ open, onClose, member }) {
  const toast = useToast();
  const f = useEntityForm(z.object({ password: z.string().min(8, 'Use at least 8 characters') }), { password: '' }, open);
  const submit = f.handleSubmit(async ({ password }) => {
    try {
      await staffService.resetPassword(member.id, password);
      toast.success(`Password reset for ${member.name.split(' ')[0]}.`);
      onClose();
    } catch (err) {
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Reset password"
      description={`${member?.name} will need to sign in again with the new password.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <FormField label="New password" name="password" type="password" autoComplete="new-password" register={f.register} errors={f.formState.errors} />
      </form>
    </Modal>
  );
}

/* ---------- shop ---------- */
const shopFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter a shop name'),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

/** Adds a new shop to the business. Every shop-specific record (staff, stock, sales) is scoped by shopId, so a fresh shop starts empty and ready to use. */
export function ShopModal({ open, onClose, onDone }) {
  const toast = useToast();
  const f = useEntityForm(shopFormSchema, { name: '', address: '', phone: '' }, open);
  const submit = f.handleSubmit(async (values) => {
    try {
      const shop = await settingsService.createShop(values);
      toast.success(`${shop.name} added. You can switch to it from the shop menu.`);
      onDone?.(shop);
      onClose();
    } catch (err) {
      applyServerErrors(err, f.setError);
      f.setServerError(err.message);
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Shop"
      description="Each shop keeps its own stock, sales, staff and reports."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={f.formState.isSubmitting}>
            Add Shop
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormError message={f.serverError} />
        <FormField label="Shop name" name="name" register={f.register} errors={f.formState.errors} placeholder="e.g. Ikeja Branch" />
        <FormField label="Address" name="address" register={f.register} errors={f.formState.errors} placeholder="Optional" />
        <FormField label="Phone" name="phone" type="tel" register={f.register} errors={f.formState.errors} placeholder="Optional" />
      </form>
    </Modal>
  );
}
