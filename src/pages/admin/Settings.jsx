import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, MapPin, Plus, Receipt, Store, Users } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { FormField, Switch } from '../../components/ui/Form.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ShopModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { settingsService } from '../../services/index.js';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the business name'),
  receiptPrefix: z.string().trim().min(1, 'Enter a prefix').max(10),
  receiptFooter: z.string().trim().max(200),
  showStaffOnReceipt: z.boolean(),
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
    form.reset({ name: b.name, receiptPrefix: b.receiptPrefix, receiptFooter: b.receiptFooter, showStaffOnReceipt: b.showStaffOnReceipt, shopName: s.name, shopAddress: s.address, shopPhone: s.phone });
  }, [data, shop?.id, form]);

  const submit = form.handleSubmit(async (v) => {
    try {
      const b = await settingsService.updateBusiness({ name: v.name, receiptPrefix: v.receiptPrefix, receiptFooter: v.receiptFooter, showStaffOnReceipt: v.showStaffOnReceipt });
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
  const signupUrl = `${window.location.origin}/signup/${business.id}`;
  const copySignupLink = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast.success('Sign-up link copied.');
    } catch {
      toast.error('Couldn’t copy the link. Select and copy it manually.');
    }
  };

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
          </div>
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
        <Section icon={Users} title="Staff sign-up link" text="Share this with new hires. New accounts stay pending until you approve them on the Staff page.">
          <div className="flex items-center gap-2.5 rounded-[14px] border border-line-2 bg-surface-2 px-3.5 py-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2">{signupUrl}</span>
            <Button type="button" size="sm" icon={Copy} onClick={copySignupLink}>
              Copy
            </Button>
          </div>
        </Section>
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
