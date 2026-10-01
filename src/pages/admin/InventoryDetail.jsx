import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bottle, SlidersHorizontal, Truck } from '../../components/icons.js';
import { Chips, Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { StockBadge } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { MovementsTable } from '../../components/MovementsTable.jsx';
import { Meter } from '../../components/Widgets.jsx';
import { AdjustModal, RestockModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { inventoryService } from '../../services/index.js';
import { money, num, plural } from '../../utils/format.js';
import { availableUnits, conversionFor, describeStock, priceFor, UNIT_LABEL } from '../../utils/units.js';

const FILTERS = [
  ['all', 'All'],
  ['RESTOCK,OPENING_STOCK', 'Restocks'],
  ['SALE', 'Sales'],
  ['CUSTOMER_RETURN,SALE_VOID', 'Returns'],
  ['DAMAGED,LOST,EXPIRED,SUPPLIER_RETURN,ADJUSTMENT', 'Adjustments'],
  ['TRANSFER_IN,TRANSFER_OUT', 'Transfers'],
];

export default function InventoryDetail() {
  const { id } = useParams();
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => inventoryService.get(id), [id]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} />;
  const v = data.item;
  const movements = filter === 'all' ? data.movements : data.movements.filter((m) => filter.split(',').includes(m.type));
  const tone = v.status === 'low' ? 'warn' : v.status === 'out' ? 'bad' : 'brand';

  return (
    <Page>
      <PageHeader
        crumbs={[['Inventory', '/admin/inventory'], [v.name]]}
        actions={
          <>
            <ButtonLink to={`/admin/products/${v.productId}`} icon={Bottle}>
              Product
            </ButtonLink>
            <Button icon={SlidersHorizontal} onClick={() => setModal('adjust')}>
              Adjust
            </Button>
            <Button variant="primary" icon={Truck} onClick={() => setModal('restock')}>
              Restock
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <ProductThumb product={v} size={60} />
          <div>
            <h1 className="text-[22px] font-bold sm:text-[24px]">{v.name}</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">
              {v.brand} · {v.category}
            </p>
          </div>
          <StockBadge status={v.status} />
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="flex flex-col gap-[18px] self-start">
          <div>
            <span className="label">Current stock</span>
            <div className="tnum mt-1 text-[34px] font-bold tracking-[-0.03em]">{plural(v.quantity, 'bottle')}</div>
            <div className="text-ink-3">{describeStock(v)}</div>
            <Meter className="mt-3 h-2" tone={tone} value={v.quantity} max={Math.max(v.lowStockThreshold * 3, 1)} />
            <p className="hint mt-1.5">
              Low stock alert at {describeStock(v, v.lowStockThreshold)} ({plural(v.lowStockThreshold, 'bottle')})
            </p>
          </div>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
            {availableUnits(v).map((u) => {
              const c = conversionFor(v, u);
              return (
                <div key={u} className="rounded-[16px] border border-line-2 bg-surface-2 px-3 py-2.5">
                  <small className="block text-[12px] text-ink-3">
                    {UNIT_LABEL[u]}s{u !== 'bottle' ? ` · ×${c}` : ''}
                  </small>
                  <b className="tnum text-[16px]">{num(Math.floor(v.quantity / c))}</b>
                  {u !== 'bottle' && v.quantity % c > 0 && <small className="block text-[12px] text-ink-3">+ {plural(v.quantity % c, 'bottle')}</small>}
                </div>
              );
            })}
          </div>
          <DetailList
            rows={[
              ['Average cost / bottle', money(v.avgCost)],
              ['Selling price / bottle', money(v.sellingPrice)],
              ...availableUnits(v)
                .filter((u) => u !== 'bottle')
                .map((u) => [`${UNIT_LABEL[u]} price`, money(priceFor(v, u))]),
              ['Inventory value', money(v.inventoryValue), true],
              ['Retail value', money(v.quantity * v.sellingPrice)],
            ]}
          />
        </Card>

        <div className="flex flex-col gap-4">
          {data.byShop && (
            <Card>
              <h3 className="mb-3 text-[16px] font-semibold">Stock by shop</h3>
              <div className="flex flex-col gap-2">
                {data.byShop.map((s) => (
                  <div key={s.shopId} className="flex items-center justify-between border-b border-line-2 py-2 text-[13.5px] last:border-0">
                    <span className="text-ink-2">{s.shopName}</span>
                    <b className="tnum">{plural(s.quantity, 'bottle')}</b>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5 text-[13.5px] font-semibold">
                  <span>Total across shops</span>
                  <b className="tnum">{plural(data.byShop.reduce((s, x) => s + x.quantity, 0), 'bottle')}</b>
                </div>
              </div>
            </Card>
          )}
          <Card flush>
            <CardHeader flush title="Inventory Movement History" action={<Chips label="Movement type" options={FILTERS} value={filter} onChange={setFilter} />} />
            <MovementsTable movements={movements} />
          </Card>
        </div>
      </div>

      <RestockModal open={modal === 'restock'} onClose={() => setModal(null)} variantId={id} onDone={reload} />
      <AdjustModal open={modal === 'adjust'} onClose={() => setModal(null)} variantId={id} onDone={reload} />
    </Page>
  );
}
