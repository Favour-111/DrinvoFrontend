import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, SlidersHorizontal, Truck } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Badge, StockBadge, Tag } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { MovementsTable } from '../../components/MovementsTable.jsx';
import { AdjustModal, RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { productService } from '../../services/index.js';
import { money, pct, plural } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, priceFor } from '../../utils/units.js';

export default function ProductDetail() {
  const { id } = useParams();
  const { data, error, reload } = useApi(() => productService.get(id), [id]);
  const [modal, setModal] = useState(null);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={3} chart={false} />;
  const { product, variants, movements } = data;
  const first = variants[0]?.variantId;

  return (
    <Page>
      <PageHeader
        crumbs={[['Products', '/admin/products'], [product.name]]}
        actions={
          <>
            <Button icon={SlidersHorizontal} onClick={() => setModal({ type: 'adjust', variantId: first })}>
              Adjust stock
            </Button>
            <Button icon={Truck} onClick={() => setModal({ type: 'restock', variantId: first })}>
              Restock
            </Button>
            <ButtonLink to={`/admin/products/${id}/edit`} variant="primary" icon={Pencil}>
              Edit product
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <ProductThumb product={product} size={64} />
          <div>
            <h1 className="text-[22px] font-bold sm:text-[24px]">{product.name}</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">
              {[product.brand, product.category, product.supplier && `Supplied by ${product.supplier.name}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {product.status === 'ARCHIVED' && <Badge>Archived</Badge>}
        </div>
      </PageHeader>
      {product.description && <p className="max-w-[65ch] text-[14px] text-ink-2">{product.description}</p>}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {variants.map((v) => (
          <Link key={v.variantId} to={`/admin/inventory/${v.variantId}`} className="card flex flex-col gap-3.5 p-5 transition-colors hover:border-brand/40">
            <div className="flex items-center justify-between">
              <Tag className="h-7 text-[13px]">{v.size}</Tag>
              <StockBadge status={v.status} />
            </div>
            <div>
              <div className="tnum text-[30px] font-bold tracking-[-0.03em]">{plural(v.quantity, 'bottle')}</div>
              <div className="text-ink-3">{describeStock(v)}</div>
            </div>
            <DetailList
              rows={[
                ['Selling price', money(v.sellingPrice)],
                ['Average cost', money(v.avgCost)],
                ['Margin', pct(((v.sellingPrice - v.avgCost) / v.sellingPrice) * 100)],
                ['Stock value', money(v.inventoryValue)],
              ]}
            />
            <div className="flex flex-wrap gap-1.5">
              {availableUnits(v).filter((u) => u !== 'bottle').length ? (
                availableUnits(v)
                  .filter((u) => u !== 'bottle')
                  .map((u) => (
                    <Tag key={u}>
                      1 {u} = {conversionFor(v, u)} · {money(priceFor(v, u))}
                    </Tag>
                  ))
              ) : (
                <Tag>Bottles only</Tag>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Card flush>
        <CardHeader flush title="Recent stock movements" action={<span className="hint">All sizes</span>} />
        <MovementsTable movements={movements || []} showVariant />
      </Card>

      <RestockModal open={modal?.type === 'restock'} onClose={() => setModal(null)} variantId={modal?.variantId} supplierId={product.supplierId ? String(product.supplierId) : undefined} onDone={reload} />
      <AdjustModal open={modal?.type === 'adjust'} onClose={() => setModal(null)} variantId={modal?.variantId} onDone={reload} />
    </Page>
  );
}

