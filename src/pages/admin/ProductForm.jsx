import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, ImagePlus, Lock, Plus, Trash2 } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, FormField, Input, MoneyInput, Select, Switch } from '../../components/ui/Form.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { productService, supplierService } from '../../services/index.js';
import { money, num, pct, plural } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const LARGE = ['pack', 'carton', 'crate'];
const DEFAULT_N = { pack: 6, carton: 24, crate: 24 };

// Disabled inputs submit undefined, so fall back instead of failing for units that are switched off
const unitRow = z.object({ on: z.boolean(), n: z.coerce.number().int().min(0).catch(0), price: z.any().optional() });
const openQtySchema = z.union([z.coerce.number().int().min(0), z.literal('')]).optional();
const variantSchema = z
  .object({
    id: z.string().optional(),
    size: z.string().trim().min(1, 'Enter a size, e.g. 50cl'),
    costPrice: z.coerce.number({ invalid_type_error: 'Enter a cost price' }).min(0, 'Cost price must be 0 or more'),
    sellingPrice: z.coerce.number({ invalid_type_error: 'Enter a selling price' }).positive('Enter a selling price'),
    minimumSellingPrice: z.union([z.coerce.number().min(0, 'Must be 0 or more'), z.literal('')]).optional(),
    pack: unitRow,
    carton: unitRow,
    crate: unitRow,
    openBottle: openQtySchema,
    openPack: openQtySchema,
    openCarton: openQtySchema,
    openCrate: openQtySchema,
    lowQty: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
    lowUnit: z.string(),
    stock: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.sellingPrice < v.costPrice) ctx.addIssue({ code: 'custom', path: ['sellingPrice'], message: 'Selling price is below cost' });
    if (Number(v.minimumSellingPrice) > v.sellingPrice) {
      ctx.addIssue({ code: 'custom', path: ['minimumSellingPrice'], message: 'Minimum selling price cannot be higher than the default selling price.' });
    }
    for (const u of LARGE) if (v[u].on && !(v[u].n > 1)) ctx.addIssue({ code: 'custom', path: [u, 'n'], message: `A ${u} must hold more than 1 bottle` });
  });
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a product name'),
  brand: z.string().trim().optional(),
  category: z.string().min(1, 'Choose a category'),
  description: z.string().max(1000).optional(),
  supplierId: z.string().optional(),
  image: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'Use an image link that starts with http:// or https://')
    .optional(),
  variants: z.array(variantSchema).min(1),
});

const newVariant = () => ({
  size: '',
  costPrice: '',
  sellingPrice: '',
  minimumSellingPrice: '',
  pack: { on: true, n: 6, price: '' },
  carton: { on: true, n: 24, price: '' },
  crate: { on: false, n: 24, price: '' },
  openBottle: '',
  openPack: '',
  openCarton: '',
  openCrate: '',
  lowQty: '',
  lowUnit: 'carton',
});
const convOf = (v, u) => (u === 'bottle' ? 1 : v?.[u]?.on ? Number(v[u].n) || 0 : 0);
const OPEN_FIELD = { pack: 'openPack', carton: 'openCarton', crate: 'openCrate' };
const openingTotalBottles = (v) =>
  (Number(v.openBottle) || 0) + LARGE.reduce((s, u) => s + (v[u]?.on ? (Number(v[OPEN_FIELD[u]]) || 0) * convOf(v, u) : 0), 0);

function toForm(product, variants) {
  return {
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    supplierId: product.supplierId ? String(product.supplierId) : '',
    image: product.image,
    variants: variants.map((v) => ({
      id: v.variantId,
      size: v.size,
      costPrice: v.costPrice,
      sellingPrice: v.sellingPrice,
      minimumSellingPrice: v.minimumSellingPrice || '',
      pack: { on: v.unitConversions.pack > 0, n: v.unitConversions.pack || 6, price: v.unitPrices.pack || '' },
      carton: { on: v.unitConversions.carton > 0, n: v.unitConversions.carton || 24, price: v.unitPrices.carton || '' },
      crate: { on: v.unitConversions.crate > 0, n: v.unitConversions.crate || 24, price: v.unitPrices.crate || '' },
      openBottle: '',
      openPack: '',
      openCarton: '',
      openCrate: '',
      lowQty: v.lowStockThreshold,
      lowUnit: 'bottle',
      stock: v.quantity,
    })),
  };
}

function toPayload(values) {
  return {
    name: values.name,
    brand: values.brand || '',
    category: values.category,
    description: values.description || '',
    image: values.image || '',
    supplierId: values.supplierId || null,
    variants: values.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      size: v.size,
      costPrice: Number(v.costPrice),
      sellingPrice: Number(v.sellingPrice),
      minimumSellingPrice: Number(v.minimumSellingPrice) || 0,
      unitConversions: Object.fromEntries(LARGE.map((u) => [u, v[u].on ? Number(v[u].n) : 0])),
      unitPrices: Object.fromEntries(LARGE.map((u) => [u, v[u].on && v[u].price ? Number(v[u].price) : 0])),
      lowStockThreshold: (Number(v.lowQty) || 0) * convOf(v, v.lowUnit),
      ...(!v.id && openingTotalBottles(v) > 0 ? { openingStock: { quantity: openingTotalBottles(v), unit: 'bottle' } } : {}),
    })),
  };
}

function BottleDots({ n }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-[3px]">
      {Array.from({ length: Math.min(n, 24) }, (_, i) => (
        <i key={i} className="h-2.5 w-[7px] rounded-[2px_2px_3px_3px] bg-brand-2 opacity-75" />
      ))}
      {n > 24 && <em className="ml-1 text-[11.5px] text-ink-3 not-italic">+{n - 24}</em>}
      <em className="ml-1 text-[11.5px] text-ink-3 not-italic">{n} bottles</em>
    </div>
  );
}

/** Lets an admin type a pack/carton/crate price instead and have the per-bottle price computed for them. */
const BULK_FIELD_LABEL = { costPrice: 'cost', sellingPrice: 'selling', minimumSellingPrice: 'minimum' };
function BulkPriceHelper({ form, path, targetField, units }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(units[0]?.key);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (units.length && !units.some((u) => u.key === unit)) setUnit(units[0].key);
  }, [units, unit]);

  if (!units.length) return null;
  const active = units.find((u) => u.key === unit) || units[0];
  const per = active?.n && amount ? Math.round((Number(amount) / active.n) * 100) / 100 : null;

  const apply = (amt, unitKey) => {
    const u = units.find((x) => x.key === unitKey);
    if (u?.n && amt) form.setValue(`${path}.${targetField}`, Math.round((Number(amt) / u.n) * 100) / 100, { shouldValidate: true, shouldDirty: true });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-left text-[12px] font-semibold text-brand-ink hover:underline">
        Calculate from a {units.map((u) => u.key).join('/')} price instead
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {units.length > 1 ? (
        <select
          aria-label={`Bulk unit for ${BULK_FIELD_LABEL[targetField]} price`}
          className="input h-9 w-[92px] px-2 text-[12.5px] capitalize"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            apply(amount, e.target.value);
          }}
        >
          {units.map((u) => (
            <option key={u.key} value={u.key}>
              {u.key}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[12.5px] font-medium text-ink-2 capitalize">{active.key}</span>
      )}
      <span className="text-[12px] text-ink-3">price</span>
      <MoneyInput
        aria-label={`Bulk ${active.key} price for ${BULK_FIELD_LABEL[targetField]} price`}
        className="h-9 w-28 text-[12.5px]"
        placeholder="18500"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          apply(e.target.value, unit);
        }}
      />
      {per != null && <span className="text-[12px] text-ink-3">= {money(per)}/bottle</span>}
      <button type="button" aria-label="Close bulk price calculator" onClick={() => setOpen(false)} className="text-[12px] text-ink-3 hover:text-ink">
        Done
      </button>
    </div>
  );
}

function VariantBlock({ index, form, onRemove, productName }) {
  const { register, watch, formState } = form;
  const v = watch(`variants.${index}`);
  const err = formState.errors.variants?.[index];
  const units = ['bottle', ...LARGE.filter((u) => v[u]?.on)];
  const bulkUnits = LARGE.filter((u) => v[u]?.on && Number(v[u].n) > 0).map((u) => ({ key: u, n: Number(v[u].n) }));
  const margin = v.costPrice && v.sellingPrice ? (v.sellingPrice - v.costPrice) / v.sellingPrice : null;
  const maxDiscount = v.sellingPrice && Number(v.minimumSellingPrice) > 0 ? Math.max(0, v.sellingPrice - Number(v.minimumSellingPrice)) : null;
  const p = `variants.${index}`;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <b className="text-[14px]">{v.size ? `${productName || 'Product'} ${v.size}` : `Size ${index + 1}`}</b>
        {onRemove && (
          <Button size="sm" variant="ghost" className="text-bad" icon={Trash2} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Size" name={`${p}.size`} register={register} errors={formState.errors} placeholder="e.g. 50cl" />
        <div>
          <FormField label="Cost price per bottle" name={`${p}.costPrice`} as="money" register={register} errors={formState.errors} placeholder="650" />
          <BulkPriceHelper form={form} path={p} targetField="costPrice" units={bulkUnits} />
        </div>
        <div>
          <FormField
            label="Selling price per bottle"
            name={`${p}.sellingPrice`}
            as="money"
            register={register}
            errors={formState.errors}
            placeholder="800"
            hint={margin !== null && margin >= 0 ? `Margin ${pct(margin * 100)} · ${money(v.sellingPrice - v.costPrice)} per bottle` : undefined}
          />
          <BulkPriceHelper form={form} path={p} targetField="sellingPrice" units={bulkUnits} />
        </div>
        <div>
          <FormField
            label="Minimum selling price"
            name={`${p}.minimumSellingPrice`}
            as="money"
            register={register}
            errors={formState.errors}
            placeholder="0"
            hint={maxDiscount != null ? `Staff can never sell below this (max discount ${money(maxDiscount)} per bottle)` : 'The lowest price staff can sell this for. Leave at 0 for no limit.'}
          />
          <BulkPriceHelper form={form} path={p} targetField="minimumSellingPrice" units={bulkUnits} />
        </div>
      </div>

      <div>
        <div className="label mb-1">Unit conversion</div>
        <p className="hint mb-2.5">Stock is counted in bottles. Turn on each way you sell this size and say how many bottles it holds.</p>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[16px] border border-line-2 bg-surface px-3 py-2.5 sm:grid-cols-[auto_118px_minmax(0,1fr)_150px]">
            <span className="rounded-[7px] bg-brand-soft px-2 py-1 text-[12px] font-medium text-brand-ink">Base</span>
            <b className="text-[13.5px]">1 Bottle</b>
            <div className="hidden sm:block">
              <i className="inline-block h-2.5 w-[7px] rounded-[2px_2px_3px_3px] bg-brand-2 opacity-75" />
            </div>
            <span className="hint hidden sm:block">{v.sellingPrice ? `${money(v.sellingPrice)} each` : ''}</span>
          </div>
          {LARGE.map((u) => {
            const on = v[u]?.on;
            const n = Number(v[u]?.n) || 0;
            const suggested = (Number(v.sellingPrice) || 0) * n;
            return (
              <div key={u} className={cn('grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[16px] border border-line-2 bg-surface px-3 py-2.5 sm:grid-cols-[auto_118px_minmax(0,1fr)_150px]', !on && 'opacity-60')}>
                <Switch checked={on} onChange={(c) => form.setValue(`${p}.${u}.on`, c, { shouldValidate: true })} label={`Sell by the ${u}`} />
                <div className="flex items-center gap-2 text-[13.5px] font-semibold whitespace-nowrap capitalize">
                  1 {u} =
                  <input
                    className="input h-[34px] w-16 px-1.5 text-center"
                    type="number"
                    min="2"
                    disabled={!on}
                    aria-label={`Bottles per ${u}`}
                    aria-invalid={err?.[u]?.n ? 'true' : undefined}
                    {...register(`${p}.${u}.n`)}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">{on ? <BottleDots n={n} /> : <em className="text-[11.5px] text-ink-3 not-italic">Not sold by the {u}</em>}</div>
                <div className="col-span-2 sm:col-span-1">
                  <MoneyInput disabled={!on} aria-label={`${u} price`} placeholder={suggested ? num(suggested) : 'Price'} {...register(`${p}.${u}.price`)} />
                </div>
                {err?.[u]?.n && <span className="col-span-full text-[12px] font-medium text-bad">{err[u].n.message}</span>}
              </div>
            );
          })}
        </div>
        <p className="hint mt-2">Leave a unit price empty to charge bottle price × bottles in the unit.</p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {v.id ? (
          <Field label="Current stock" hint="Change stock with Restock or Stock adjustment so every change is recorded.">
            <div className="input flex items-center bg-surface-2">{plural(v.stock, 'bottle')}</div>
          </Field>
        ) : (
          <Field label="Opening stock" hint={`= ${plural(openingTotalBottles(v), 'bottle')} total`}>
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <div key={u} className="min-w-[88px] flex-1">
                  <label htmlFor={`${p}-open-${u}`} className="mb-1 block text-[11.5px] font-medium text-ink-3 capitalize">
                    {u}s
                  </label>
                  <Input id={`${p}-open-${u}`} type="number" min="0" placeholder="0" aria-label={`Opening stock in ${u}s`} {...register(`${p}.${u === 'bottle' ? 'openBottle' : OPEN_FIELD[u]}`)} />
                </div>
              ))}
            </div>
          </Field>
        )}
        <Field label="Low stock alert at" hint={`Alert when stock falls to ${plural((Number(v.lowQty) || 0) * convOf(v, v.lowUnit), 'bottle')}`}>
          <div className="flex gap-2">
            <Input type="number" min="0" placeholder="10" aria-label="Low stock threshold" {...register(`${p}.lowQty`)} />
            <Select className="w-[130px]" aria-label="Low stock unit" {...register(`${p}.lowUnit`)}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u[0].toUpperCase() + u.slice(1)}s
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </div>
    </div>
  );
}

function Section({ n, title, text, children }) {
  return (
    <Card>
      <div className="mb-[18px] flex items-start gap-3">
        <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-brand-soft text-[13px] font-bold text-brand">{n}</span>
        <div>
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{text}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const edit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState('');

  const existing = useApi(() => (edit ? productService.get(id) : Promise.resolve(null)), [id]);
  const categories = useApi(() => productService.categories(), []);
  const suppliers = useApi(() => supplierService.list(), []);
  const catalog = useApi(() => productService.list(), []);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', brand: '', category: 'Soft Drink', description: '', supplierId: '', image: '', variants: [newVariant()] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });

  useEffect(() => {
    if (existing.data) form.reset(toForm(existing.data.product, existing.data.variants));
  }, [existing.data, form]);

  const values = form.watch();

  // De-duplicated against the current typed name as the admin types it, so a near-identical
  // product (e.g. retyping "Coca-Cola" as a new entry instead of adding a size to the existing
  // one) gets caught before it creates a confusing duplicate in the catalog.
  const catalogProducts = useMemo(() => {
    const seen = new Map();
    for (const row of catalog.data?.items || []) {
      if (!seen.has(row.productId)) seen.set(row.productId, { id: row.productId, name: row.productName, brand: row.brand, category: row.category });
    }
    return [...seen.values()];
  }, [catalog.data]);
  const typedName = values.name.trim().toLowerCase();
  const nameMatches = useMemo(() => {
    if (typedName.length < 2) return [];
    return catalogProducts.filter((p) => p.id !== id && p.name.toLowerCase().includes(typedName));
  }, [catalogProducts, typedName, id]);
  const exactNameMatch = nameMatches.find((p) => p.name.trim().toLowerCase() === typedName);

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await productService.uploadImage(file);
      form.setValue('image', url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = form.handleSubmit(
    async (vals) => {
      setServerError('');
      try {
        const payload = toPayload(vals);
        const res = edit ? await productService.update(id, payload) : await productService.create(payload);
        toast.success(edit ? 'Product updated.' : 'Product added successfully.');
        navigate(`/admin/products/${res.id}`);
      } catch (err) {
        setServerError(err.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    () => {
      toast.error('Fix the highlighted details to save.');
    }
  );

  if (edit && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if (edit && !existing.data) return <PageSkeleton stats={0} />;

  const name = values.name;
  return (
    <Page>
      <PageHeader
        crumbs={[['Products', '/admin/products'], ...(edit ? [[existing.data.product.name, `/admin/products/${id}`]] : []), [edit ? 'Edit' : 'Add product']]}
        title={edit ? `Edit ${existing.data.product.name}` : 'Add Product'}
        subtitle={edit ? 'Price and cost changes are logged in Activity.' : 'Add a drink with one or more sizes. Each size has its own prices, stock and units.'}
      />
      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] font-medium text-bad">
          <AlertTriangle size={18} className="flex-none" />
          {serverError}
        </div>
      )}
      <form onSubmit={submit} className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <Section n={1} title="Product information" text="What the drink is called and how you group it.">
            <div className="grid gap-3.5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="Product name" name="name" register={form.register} errors={form.formState.errors} placeholder="e.g. Coca-Cola" />
                <FormField label="Brand" name="brand" register={form.register} errors={form.formState.errors} placeholder="e.g. Nigerian Bottling Company" />
              </div>
              {nameMatches.length > 0 && (
                <div className={cn('flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-[13px]', exactNameMatch ? 'border-bad/25 bg-bad-soft' : 'border-warn/25 bg-warn-soft')}>
                  <AlertTriangle size={16} className={cn('mt-0.5 flex-none', exactNameMatch ? 'text-bad' : 'text-warn')} />
                  <div className="min-w-0 flex-1">
                    <b className={cn('block font-semibold', exactNameMatch ? 'text-bad' : 'text-warn')}>
                      {exactNameMatch ? 'A product with this exact name already exists' : 'Similar products already exist'}
                    </b>
                    <p className="mt-0.5 text-ink-2">
                      {exactNameMatch
                        ? 'Adding this as a new product will create a duplicate. Open it below and add a size instead, if that’s what you meant.'
                        : 'Check these aren’t the same drink before adding it as new.'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {nameMatches.slice(0, 5).map((p) => (
                        <Link
                          key={p.id}
                          to={`/admin/products/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_transparent] transition-colors hover:border-brand/40 hover:text-brand-ink"
                        >
                          {p.name}
                          {p.brand ? <span className="text-ink-3">· {p.brand}</span> : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Category" htmlFor="pf-category" error={form.formState.errors.category?.message}>
                  <Combobox
                    id="pf-category"
                    value={values.category}
                    onChange={(v) => form.setValue('category', v, { shouldValidate: true })}
                    options={(categories.data || ['Soft Drink']).map((c) => ({ value: c, label: c }))}
                    placeholder="Search categories…"
                  />
                </Field>
                <Field label="Main supplier" htmlFor="pf-supplier">
                  <Combobox
                    id="pf-supplier"
                    value={values.supplierId}
                    onChange={(v) => form.setValue('supplierId', v, { shouldValidate: true })}
                    options={[{ value: '', label: 'None' }, ...(suppliers.data || []).map((s) => ({ value: s.id, label: s.name }))]}
                    placeholder="Search suppliers…"
                  />
                </Field>
              </div>
              <FormField label="Description" name="description" as="textarea" register={form.register} errors={form.formState.errors} placeholder="Optional notes, e.g. returnable bottle" />
              <Field label="Image">
                <label className="relative flex cursor-pointer items-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed border-line bg-surface-2 p-3.5">
                  {values.image ? <ProductThumb product={{ image: values.image }} size={56} /> : <span className="grid size-14 place-items-center rounded-[11px] bg-brand-soft text-brand"><ImagePlus size={24} /></span>}
                  <span>
                    <b className="font-semibold">{uploading ? 'Uploading…' : values.image ? 'Replace image' : 'Upload an image'}</b>
                    <br />
                    <span className="hint">PNG, JPG or WebP up to 2 MB. A bottle icon is used if you skip this.</span>
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Upload product image" />
                </label>
              </Field>
              <div className="flex items-end gap-2">
                <FormField
                  className="flex-1"
                  label="Or paste an image link"
                  name="image"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/coca-cola.png"
                  register={form.register}
                  errors={form.formState.errors}
                  hint={values.image ? 'The preview updates as you paste. If the link breaks, the bottle icon shows instead.' : 'Right-click an image online and choose “Copy image address”.'}
                />
                {values.image && (
                  <Button className="mb-[22px]" onClick={() => form.setValue('image', '', { shouldValidate: true })}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Section>

          <Section n={2} title="Sizes, pricing & units" text="Each size keeps its own cost, selling price, stock and conversions.">
            <div className="grid gap-4">
              {fields.map((f, i) => (
                <VariantBlock key={f.id} index={i} form={form} productName={name} onRemove={fields.length > 1 && !values.variants[i]?.id ? () => remove(i) : null} />
              ))}
              <Button icon={Plus} className="justify-self-start" onClick={() => append(newVariant())}>
                Add another size
              </Button>
            </div>
          </Section>
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-[84px]">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16.5px] font-semibold">Preview</h3>
              <span className="hint">What staff see</span>
            </div>
            <div className="mb-3.5 flex items-center gap-3">
              <ProductThumb product={{ image: values.image, color: existing.data?.product.color }} size={48} />
              <div>
                <b className="block font-semibold">{name || 'Product name'}</b>
                <small className="text-[12px] text-ink-3">{values.category}</small>
              </div>
            </div>
            {values.variants.map((v, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <b className="block font-semibold">{v.size || 'Size'}</b>
                  <small className="text-[12.5px] text-ink-3">
                    {LARGE.filter((u) => v[u]?.on).map((u) => `1 ${u} = ${v[u].n}`).join(' · ') || 'Bottles only'}
                  </small>
                </div>
                <div className="text-right">
                  <b className="tnum block font-semibold">{v.sellingPrice ? money(v.sellingPrice) : '—'}</b>
                  <small className="text-[12px] text-ink-3">per bottle</small>
                </div>
              </div>
            ))}
            <div className="mt-3 flex gap-2.5 rounded-[16px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
              <Lock size={16} className="flex-none text-ink-3" />
              Staff never see cost price or margin.
            </div>
          </Card>
          <div className="flex gap-2">
            <Button block onClick={() => navigate(edit ? `/admin/products/${id}` : '/admin/products')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" block loading={form.formState.isSubmitting}>
              {edit ? 'Save changes' : 'Save product'}
            </Button>
          </div>
        </aside>
      </form>
    </Page>
  );
}
