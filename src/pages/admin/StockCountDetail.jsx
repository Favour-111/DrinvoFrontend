import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, SlidersHorizontal } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { AdjustModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { stockCountService } from '../../services/index.js';
import { fmtDateTime, plural } from '../../utils/format.js';
import { UNIT_LABEL } from '../../utils/units.js';
import { cn } from '../../utils/cn.js';

const TYPE_TONE = { MATCHED: 'neutral', SHORTAGE: 'bad', OVERAGE: 'ok' };
const TYPE_LABEL = { MATCHED: 'Matched', SHORTAGE: 'Shortage', OVERAGE: 'Overage' };

export default function StockCountDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [reviewing, setReviewing] = useState(false);
  const [adjusting, setAdjusting] = useState(null); // variantId to pre-open AdjustModal for
  const { data, error, reload } = useApi(() => stockCountService.get(id), [id]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const markReviewed = async () => {
    setReviewing(true);
    try {
      await stockCountService.review(id);
      toast.success('Marked as reviewed.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const withDifference = data.items.filter((i) => i.type !== 'MATCHED');

  return (
    <Page>
      <PageHeader
        crumbs={[['Physical Counts', '/admin/stock-counts'], [data.countNumber]]}
        title={data.countNumber}
        subtitle={`Counted by ${data.performedBy?.name || 'Unknown'} · ${fmtDateTime(data.createdAt)}`}
        actions={
          data.status === 'SUBMITTED' && (
            <Button variant="primary" icon={ClipboardCheck} onClick={markReviewed} loading={reviewing}>
              Mark as Reviewed
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={data.status === 'SUBMITTED' ? 'warn' : 'ok'}>{data.status === 'SUBMITTED' ? 'Awaiting review' : 'Reviewed'}</Badge>
        {data.summary.SHORTAGE > 0 && <Badge tone="bad">{plural(data.summary.SHORTAGE, 'product')} short</Badge>}
        {data.summary.OVERAGE > 0 && <Badge tone="ok">{plural(data.summary.OVERAGE, 'product')} over</Badge>}
        {data.summary.SHORTAGE === 0 && data.summary.OVERAGE === 0 && <Badge tone="neutral">Everything matched</Badge>}
        {data.reviewedBy && (
          <span className="text-[12.5px] text-ink-3">
            Reviewed by {data.reviewedBy.name} · {fmtDateTime(data.reviewedAt)}
          </span>
        )}
      </div>

      {withDifference.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-bad-soft text-bad">
              <AlertTriangle size={19} />
            </span>
            <div>
              <b className="text-[14.5px]">Stock difference detected</b>
              <p className="mt-0.5 text-[13.5px] text-ink-2">
                {plural(withDifference.length, 'product')} didn’t match what the system expected. Open a product’s movement history to see recent sales, transfers, restocks and adjustments, then
                record a stock adjustment if the count was correct.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card flush>
        <CardHeader flush title="Products counted" />
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>Product</th>
                <th>Counted as</th>
                <th className="num">Expected</th>
                <th className="num">Physical</th>
                <th className="num">Difference</th>
                <th>Type</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.variantId}>
                  <td className="font-semibold">
                    <Link to={`/admin/inventory/${i.variantId}`} className="flex items-center gap-1.5 hover:text-brand-ink">
                      {i.name}
                      <ChevronRight size={14} className="text-ink-3" />
                    </Link>
                    {i.notes && <small className="block font-normal text-ink-3">{i.notes}</small>}
                  </td>
                  <td className="text-ink-2">{i.countedUnits.map((u) => `${u.quantity} ${UNIT_LABEL[u.unit]}${u.quantity === 1 ? '' : 's'}`).join(' + ')}</td>
                  <td className="num tnum">{plural(i.expectedQuantity, 'bottle')}</td>
                  <td className="num tnum font-semibold">{plural(i.physicalQuantity, 'bottle')}</td>
                  <td className={cn('num tnum font-semibold', i.difference < 0 ? 'text-bad' : i.difference > 0 ? 'text-ok' : 'text-ink-3')}>
                    {i.difference > 0 ? '+' : ''}
                    {i.difference}
                  </td>
                  <td>
                    <Badge tone={TYPE_TONE[i.type]}>{TYPE_LABEL[i.type]}</Badge>
                  </td>
                  <td className="num">
                    {i.type !== 'MATCHED' && (
                      <Button size="sm" icon={SlidersHorizontal} onClick={() => setAdjusting(i)}>
                        Adjust Stock
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data.notes && (
        <Card>
          <div className="label mb-1.5">Notes</div>
          <p className="text-[13.5px] text-ink-2">{data.notes}</p>
        </Card>
      )}

      <AdjustModal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        onDone={reload}
        variantId={adjusting?.variantId}
        initialQuantity={adjusting ? Math.abs(adjusting.difference) : undefined}
        initialDirection={adjusting?.difference < 0 ? 'remove' : 'add'}
        initialNotes={
          adjusting
            ? `Physical count ${data.countNumber}: expected ${plural(adjusting.expectedQuantity, 'bottle')}, counted ${plural(adjusting.physicalQuantity, 'bottle')}.`
            : undefined
        }
      />
    </Page>
  );
}
