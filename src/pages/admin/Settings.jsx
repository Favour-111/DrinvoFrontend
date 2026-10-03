import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, LayoutGrid, Lock, MapPin, MessageCircle, Pencil, Plus, Power, Receipt, Store, Trash2, X } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Field, FormField, Input, Switch } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ShopModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { settingsService } from '../../services/index.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StaffAccessSection({ business, onSaved }) {
  const toast = useToast();
  const access = business.staffAccess || {};
  const [local, setLocal] = useState({
    scheduleEnabled: Boolean(access.scheduleEnabled),
    start: access.start || '09:00',
    end: access.end || '21:00',
    days: access.days?.length === 7 ? access.days : [true, true, true, true, true, true, true],
  });
  const [shutdown, setShutdown] = useState(Boolean(access.shutdown));
  const [confirmOff, setConfirmOff] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const applyShutdown = async (next) => {
    try {
      await settingsService.updateBusiness({ staffAccess: { shutdown: next } });
      setShutdown(next);
      onSaved();
      toast.success(next ? 'Staff access turned off. Staff are signed out immediately.' : 'Staff access turned back on.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await settingsService.updateBusiness({ staffAccess: local });
      onSaved();
      toast.success('Staff access schedule saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <Section icon={Lock} title="Staff Access" text="Control when staff can sign in, and shut it off instantly if you need to.">
      <div className="flex flex-col gap-3.5">
        <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
          <span className="flex items-center gap-2">
            <Power size={15} className={shutdown ? 'text-bad' : 'text-ok'} />
            Staff Access: <b className={shutdown ? 'text-bad' : 'text-ok'}>{shutdown ? 'OFF' : 'ON'}</b>
          </span>
          <Switch checked={!shutdown} onChange={(v) => (v ? applyShutdown(false) : setConfirmOff(true))} label="Staff access" />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
          <span>Restrict sign-in to a schedule</span>
          <Switch checked={local.scheduleEnabled} onChange={(v) => setLocal((s) => ({ ...s, scheduleEnabled: v }))} label="Restrict sign-in to a schedule" />
        </label>

        {local.scheduleEnabled && (
          <>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Opens at">
                <Input type="time" value={local.start} onChange={(e) => setLocal((s) => ({ ...s, start: e.target.value }))} />
              </Field>
              <Field label="Closes at">
                <Input type="time" value={local.end} onChange={(e) => setLocal((s) => ({ ...s, end: e.target.value }))} />
              </Field>
            </div>
            <div>
              <div className="label mb-1.5">Days staff can sign in</div>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={local.days[i]}
                    onClick={() => setLocal((s) => ({ ...s, days: s.days.map((d, di) => (di === i ? !d : d)) }))}
                    className={`h-9 flex-1 rounded-[9px] border text-[12.5px] font-semibold transition-colors ${
                      local.days[i] ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-3/30'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="primary" size="sm" loading={savingSchedule} onClick={saveSchedule}>
            Save access schedule
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => applyShutdown(true)}
        title="Turn off staff access?"
        confirmLabel="Turn off"
        icon={Power}
      >
        <p>Every signed-in staff member will be signed out immediately, and no one can sign in until you turn this back on.</p>
        <p>Admin access is not affected.</p>
      </ConfirmDialog>
    </Section>
  );
}

function CategoriesSection({ categories, onSaved }) {
  const toast = useToast();
  const [adding, setAdding] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const persist = async (next, successMsg) => {
    setBusy(true);
    try {
      await settingsService.updateBusiness({ categories: next });
      await onSaved();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = adding.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      toast.error('That category already exists.');
      return;
    }
    await persist([...categories, name], 'Category added.');
    setAdding('');
  };

  const renameCategory = async (idx) => {
    const name = editValue.trim();
    if (!name) return;
    if (name === categories[idx]) {
      setEditingIdx(null);
      return;
    }
    if (categories.some((c, i) => i !== idx && c.toLowerCase() === name.toLowerCase())) {
      toast.error('That category already exists.');
      return;
    }
    await persist(categories.map((c, i) => (i === idx ? name : c)), 'Category renamed.');
    setEditingIdx(null);
  };

  const removeCategory = async () => {
    await persist(categories.filter((c) => c !== deleting), 'Category deleted.');
    setDeleting(null);
  };

  return (
    <Section icon={LayoutGrid} title="Categories" text="Used to organize and filter your products.">
      <div className="flex flex-col gap-1.5">
        {categories.map((c, i) =>
          editingIdx === i ? (
            <div key={c} className="flex items-center gap-2 rounded-[12px] border border-brand/30 bg-surface-2 px-2.5 py-1.5">
              <Input
                autoFocus
                value={editValue}
                maxLength={60}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameCategory(i);
                  if (e.key === 'Escape') setEditingIdx(null);
                }}
                className="h-9 flex-1"
              />
              <IconButton size={32} icon={Check} label="Save" disabled={busy} onClick={() => renameCategory(i)} />
              <IconButton size={32} icon={X} label="Cancel" disabled={busy} onClick={() => setEditingIdx(null)} />
            </div>
          ) : (
            <div key={c} className="flex items-center gap-2.5 rounded-[12px] border border-line-2 bg-surface-2 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c}</span>
              <IconButton
                size={32}
                icon={Pencil}
                label={`Rename ${c}`}
                disabled={busy}
                onClick={() => {
                  setEditingIdx(i);
                  setEditValue(c);
                }}
              />
              <IconButton size={32} icon={Trash2} label={`Delete ${c}`} disabled={busy} onClick={() => setDeleting(c)} />
            </div>
          )
        )}
        {!categories.length && <p className="text-[13px] text-ink-3">No categories yet. Add one below.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={adding}
          maxLength={60}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="New category, e.g. Wine"
          aria-label="New category name"
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          className="h-10 flex-1"
        />
        <Button type="button" icon={Plus} loading={busy} onClick={addCategory}>
          Add
        </Button>
      </div>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={removeCategory} title={`Delete “${deleting}”?`} confirmLabel="Delete" icon={Trash2}>
        <p>Products already using this category keep it — it just won’t be suggested for new products anymore.</p>
      </ConfirmDialog>
    </Section>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the business name'),
  receiptPrefix: z.string().trim().min(1, 'Enter a prefix').max(10),
  receiptFooter: z.string().trim().max(200),
  showStaffOnReceipt: z.boolean(),
  showDiscountOnReceipt: z.boolean(),
  whatsappNumber: z.string().trim().max(30),
  shopName: z.string().trim().min(2, 'Enter a shop name'),
  shopAddress: z.string().trim().max(240),
  shopPhone: z.string().trim().max(40),
});

const PERMISSIONS = [
  ['Record sales', true, true],
  ['View own sales and receipts', true, true],
  ['View stock levels', true, true],
  ['View cost price and profit', true, false],
  ['Add, edit or archive products', true, false],
  ['Change prices', true, false],
  ['Restock and adjust inventory', true, false],
  ['Returns, refunds and voids', true, false],
  ['Manage suppliers and credit', true, false],
  ['Manage staff and settings', true, false],
];

function Section({ icon: Icon, title, text, children }) {
  return (
    <Card>
      <div className="mb-[18px] flex items-start gap-3">
        <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-brand-soft text-brand">
          <Icon size={15} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{text}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function Settings() {
  const { shop, updateBusiness, refresh } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useApi(() => Promise.all([settingsService.business(), settingsService.shops()]), []);
  const form = useForm({ resolver: zodResolver(schema) });
  const [addingShop, setAddingShop] = useState(false);

  useEffect(() => {
    if (!data) return;
    const [b, shops] = data;
    const s = shops.find((x) => x.id === shop?.id) || shops[0];
    form.reset({
      name: b.name,
      receiptPrefix: b.receiptPrefix,
      receiptFooter: b.receiptFooter,
      showStaffOnReceipt: b.showStaffOnReceipt,
      showDiscountOnReceipt: b.showDiscountOnReceipt ?? true,
      whatsappNumber: b.whatsappNumber || '',
      shopName: s.name,
      shopAddress: s.address,
      shopPhone: s.phone,
    });
  }, [data, shop?.id, form]);

  const submit = form.handleSubmit(async (v) => {
    try {
      const b = await settingsService.updateBusiness({
        name: v.name,
        receiptPrefix: v.receiptPrefix,
        receiptFooter: v.receiptFooter,
        showStaffOnReceipt: v.showStaffOnReceipt,
        showDiscountOnReceipt: v.showDiscountOnReceipt,
        whatsappNumber: v.whatsappNumber,
      });
      await settingsService.updateShop(shop.id, { name: v.shopName, address: v.shopAddress, phone: v.shopPhone });
      updateBusiness(b);
      await refresh();
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err.message);
    }
  });

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;
  const [business, shops] = data;
  const e = form.formState.errors;
  const reg = form.register;

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Business profile, receipts, shops and roles." />
      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-2">
        <Section icon={Store} title="Business" text="Shown on receipts and reports.">
          <div className="grid gap-3.5">
            <FormField label="Business name" name="name" register={reg} errors={e} />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField label="Shop name" name="shopName" register={reg} errors={e} />
              <FormField label="Shop phone" name="shopPhone" type="tel" register={reg} errors={e} />
            </div>
            <FormField label="Shop address" name="shopAddress" register={reg} errors={e} />
          </div>
        </Section>
        <Section icon={Receipt} title="Receipts" text="How receipts are numbered and signed off.">
          <div className="grid gap-3.5">
            <FormField label="Receipt prefix" name="receiptPrefix" register={reg} errors={e} hint="e.g. INV- gives INV-000124" />
            <FormField label="Footer message" name="receiptFooter" register={reg} errors={e} />
            <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
              <span>Show staff name on receipts</span>
              <Switch checked={Boolean(form.watch('showStaffOnReceipt'))} onChange={(v) => form.setValue('showStaffOnReceipt', v, { shouldDirty: true })} label="Show staff name on receipts" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13.5px]">
              <span>
                Show discounts on customer receipts
                <small className="block text-[12px] text-ink-3">Turn off to hide discount amounts from printed/shared receipts. Admin sale records always show the full discount.</small>
              </span>
              <Switch checked={Boolean(form.watch('showDiscountOnReceipt'))} onChange={(v) => form.setValue('showDiscountOnReceipt', v, { shouldDirty: true })} label="Show discounts on customer receipts" />
            </label>
          </div>
        </Section>
        <Section icon={MessageCircle} title="Customer Communication" text="Used by the WhatsApp price-share feature on sales pages.">
          <FormField
            label="Shop's WhatsApp number"
            name="whatsappNumber"
            type="tel"
            register={reg}
            errors={e}
            placeholder="e.g. 2348012345678"
            hint="There's no WhatsApp API connected — sharing a price list opens WhatsApp with the message ready to send. Use the device that's signed in with this number (not a staff member's personal WhatsApp) so prices go out from the shop's own account."
          />
        </Section>
        <Section icon={MapPin} title="Shops" text="Every record is stored against a shop, so more branches can be added later.">
          {shops.map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-line-2 py-3">
              <Store size={18} className="text-ink-3" />
              <div className="min-w-0 flex-1">
                <b className="font-semibold">{s.name}</b>
                <small className="block text-[12.5px] text-ink-3">{s.address}</small>
              </div>
              <Badge tone="ok">Active</Badge>
            </div>
          ))}
          <button type="button" onClick={() => setAddingShop(true)} className="flex w-full items-center gap-3 rounded-[12px] py-3 text-left transition-colors hover:bg-surface-2">
            <Plus size={18} className="text-brand" />
            <div className="flex-1">
              <b className="font-semibold text-brand-ink">Add a branch</b>
              <small className="block text-[12.5px] text-ink-3">Give it its own stock, sales and staff</small>
            </div>
          </button>
        </Section>
        <StaffAccessSection business={business} onSaved={() => Promise.all([reload(), refresh()])} />
        <CategoriesSection categories={business.categories || []} onSaved={() => Promise.all([reload(), refresh()])} />
        <Card flush>
          <CardHeader flush title="Roles & permissions" action={<span className="hint">More roles can be added later</span>} />
          <div className="overflow-x-auto">
            <table className="table min-w-[420px]">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th className="num">Admin</th>
                  <th className="num">Staff</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(([p, a, s]) => (
                  <tr key={p}>
                    <td>{p}</td>
                    <td className="num font-bold text-ok">{a ? '✓' : '—'}</td>
                    <td className={`num font-bold ${s ? 'text-ok' : 'text-ink-3'}`}>{s ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="flex justify-end xl:col-span-2">
          <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
            Save settings
          </Button>
        </div>
      </form>
      <ShopModal
        open={addingShop}
        onClose={() => setAddingShop(false)}
        onDone={async () => {
          await Promise.all([reload(), refresh()]);
        }}
      />
    </Page>
  );
}
