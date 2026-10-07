import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Boxes, Layers, Percent, Pencil, Tag as TagIcon, SlidersHorizontal, Truck, Wallet, History } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList, StatBar } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Badge, StockBadge, Tag } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { MovementsTable } from '../../components/MovementsTable.jsx';
import { AdjustModal, RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { productService } from '../../services/index.js';
import { money, num, pct, plural } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import { availableUnits, conversionFor, describeStock, priceFor } from '../../utils/units.js';

export default function ProductDetail() {
  const { id } = useParams();
  const { data, error, reload } = useApi(() => productService.get(id), [id]);
  const [modal, setModal] = useState(null);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={3} chart={false} />;
  const { product, variants, movements } = data;
  const first = variants[0]?.variantId;

  const totalBottles = variants.reduce((n, v) => n + v.quantity, 0);
  const stockValue = variants.reduce((n, v) => n + v.inventoryValue, 0);
  const avgMargin = variants.length ? variants.reduce((n, v) => n + (v.sellingPrice > 0 ? ((v.sellingPrice - v.avgCost) / v.sellingPrice) * 100 : 0), 0) / variants.length : 0;

  return (
    <Page>
      <PageHeader
        crumbs={[['Products', '/admin/products'], [product.name]]}
      />

      <Card className="relative overflow-hidden p-0">
        <span className="blob -top-24 -right-16 size-72 opacity-40" aria-hidden="true" />
        <div className="relative z-10 flex flex-wrap gap-2 sm:absolute sm:top-5 sm:right-5">
          <Button icon={SlidersHorizontal} onClick={() => setModal({ type: 'adjust', variantId: first })}>
            Adjust stock
          </Button>
          <Button icon={Truck} onClick={() => setModal({ type: 'restock', variantId: first })}>
            Restock
          </Button>
          <ButtonLink to={`/admin/products/${id}/edit`} variant="primary" icon={Pencil}>
            Edit product
          </ButtonLink>
        </div>
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6 sm:pr-[340px]">
          <span
            className="grid size-[104px] flex-none place-items-center rounded-[22px] shadow-[inset_0_0_0_1px_var(--line),0_12px_26px_-16px_var(--brand-2)]"
            style={{ background: `color-mix(in srgb, ${product.color || '#059669'} 16%, var(--surface-2))` }}
          >
            <ProductThumb product={product} size={84} fill />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold tracking-[-0.02em] sm:text-[27px]">{product.name}</h1>
              {product.status === 'ARCHIVED' ? <Badge tone="neutral">Archived</Badge> : <Badge tone="ok">Active</Badge>}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {product.brand && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"><TagIcon size={13} className="text-ink-3" />{product.brand}</span>}
              {product.category && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"><Layers size={13} className="text-ink-3" />{product.category}</span>}
              {product.supplier && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"><Truck size={13} className="text-ink-3" />Supplied by {product.supplier.name}</span>}
            </div>
            {product.description && <p className="mt-3 max-w-[65ch] text-[14px] leading-relaxed text-ink-2">{product.description}</p>}
          </div>
        </div>
      </Card>

      <StatBar
        items={[
          { key: 'stock', label: 'Current stock', value: `${num(totalBottles)} bottles`, icon: Boxes, iconTone: 'brand', footer: plural(variants.length, 'size') },
          { key: 'value', label: 'Stock value', value: money(stockValue), icon: Wallet, iconTone: 'ok', footer: 'at average cost' },
          { key: 'margin', label: 'Average margin', value: pct(avgMargin), icon: Percent, iconTone: 'profit', footer: 'across sizes' },
          { key: 'sizes', label: 'Sizes', value: num(variants.length), icon: Layers, iconTone: 'info', footer: variants.map((v) => v.size).join(' · ') || 'none' },
        ]}
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        {variants.map((v) => {
          const ceiling = Math.max(v.lowStockThreshold * 3, v.quantity, 1);
          const fill = Math.min(100, (v.quantity / ceiling) * 100);
          const tone = v.status === 'out' ? 'bg-bad' : v.status === 'low' ? 'bg-warn' : 'bg-brand-2';
          const bigUnits = availableUnits(v).filter((u) => u !== 'bottle');
          return (
            <Link key={v.variantId} to={`/admin/inventory/${v.variantId}`} className="card card-lift flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <Tag className="h-7 px-3 text-[13px] font-semibold text-ink">{v.size}</Tag>
                <StockBadge status={v.status} />
              </div>
              <div>
                <div className="tnum text-[30px] font-bold tracking-[-0.03em]">{plural(v.quantity, 'bottle')}</div>
                <div className="text-[13px] text-ink-3">{describeStock(v)}</div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${fill}%` }} />
                </div>
              </div>
              <DetailList
                rows={[
                  ['Selling price', money(v.sellingPrice)],
                  ['Average cost', money(v.avgCost)],
                  ['Margin', pct(((v.sellingPrice - v.avgCost) / v.sellingPrice) * 100)],
                  ['Minimum price', v.minimumSellingPrice > 0 ? money(v.minimumSellingPrice) : 'No limit'],
                  ...(v.minimumSellingPrice > 0 ? [['Discount room', money(Math.max(0, v.sellingPrice - v.minimumSellingPrice))]] : []),
                  ['Stock value', money(v.inventoryValue)],
                ]}
              />
              <div className="flex flex-wrap gap-1.5 border-t border-line-2 pt-3.5">
                {bigUnits.length ? (
                  bigUnits.map((u) => (
                    <Tag key={u} className="bg-brand-soft text-brand-ink">
                      1 {u} = {conversionFor(v, u)} · {money(priceFor(v, u))}
                    </Tag>
                  ))
                ) : (
                  <Tag>Bottles only</Tag>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <Card flush className="overflow-hidden">
        <CardHeader
          flush
          title={
            <span className="flex items-center gap-2.5">
              <span className="tile tile-info size-8 rounded-[10px]">
                <History size={16} />
              </span>
              Recent stock movements
            </span>
          }
          action={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-3">All sizes</span>}
        />
        <MovementsTable movements={movements || []} showVariant />
      </Card>

      <RestockModal open={modal?.type === 'restock'} onClose={() => setModal(null)} variantId={modal?.variantId} supplierId={product.supplierId ? String(product.supplierId) : undefined} onDone={reload} />
      <AdjustModal open={modal?.type === 'adjust'} onClose={() => setModal(null)} variantId={modal?.variantId} onDone={reload} />
    </Page>
  );
}

