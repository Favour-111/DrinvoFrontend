import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, SlidersHorizontal } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { AdjustModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { inventoryService, stockCountService } from '../../services/index.js';
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
  const [selected, setSelected] = useState(() => new Set());
  const [applied, setApplied] = useState(() => new Set()); // variantIds already adjusted from this page
  const [bulk, setBulk] = useState(null); // rows queued for the bulk-adjust confirmation
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
  const pending = withDifference.filter((i) => !applied.has(i.variantId));
  const selectedRows = pending.filter((i) => selected.has(i.variantId));
  const allSelected = pending.length > 0 && selectedRows.length === pending.length;
  const toggle = (vid) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(vid) ? n.delete(vid) : n.add(vid);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pending.map((i) => i.variantId)));

  // Applies each count difference as a CORRECTION, the same as the single Adjust Stock flow.
  const applyBulk = async () => {
    const done = [];
    let failed = null;
    for (const i of bulk) {
      try {
        await inventoryService.adjust({
          variantId: i.variantId,
          type: 'CORRECTION',
          direction: i.difference < 0 ? 'remove' : 'add',
          unit: 'bottle',
          quantity: Math.abs(i.difference),
          notes: `Physical count ${data.countNumber}: expected ${plural(i.expectedQuantity, 'bottle')}, counted ${plural(i.physicalQuantity, 'bottle')}.`,
        });
        done.push(i.variantId);
      } catch (err) {
        failed = `${i.name}: ${err.message}`;
        break;
      }
    }
    setApplied((a) => new Set([...a, ...done]));
    setSelected((s) => new Set([...s].filter((x) => !done.includes(x))));
    if (done.length) {
      toast.success(`Adjusted ${plural(done.length, 'product')}.`);
      reload();
    }
    if (failed) {
      toast.error(`Stopped at ${failed}`);
      throw new Error(failed);
    }
  };

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
        <CardHeader
          flush
          title="Products counted"
          action={
            pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={SlidersHorizontal} disabled={!selectedRows.length} onClick={() => setBulk(selectedRows)}>
                  Adjust selected{selectedRows.length ? ` (${selectedRows.length})` : ''}
                </Button>
                <Button size="sm" variant="primary" icon={SlidersHorizontal} onClick={() => setBulk(pending)}>
                  Adjust all stock ({pending.length})
                </Button>
              </div>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input type="checkbox" aria-label="Select all products with a difference" checked={allSelected} disabled={!pending.length} onChange={toggleAll} />
                </th>
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
                  <td>
                    {i.type !== 'MATCHED' && !applied.has(i.variantId) && (
                      <input type="checkbox" aria-label={`Select ${i.name}`} checked={selected.has(i.variantId)} onChange={() => toggle(i.variantId)} />
                    )}
                  </td>
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
                    {applied.has(i.variantId) ? (
                      <Badge tone="ok">Adjusted</Badge>
                    ) : (
                      i.type !== 'MATCHED' && (
                      <Button size="sm" icon={SlidersHorizontal} onClick={() => setAdjusting(i)}>
                        Adjust Stock
                      </Button>
                      )
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

      <ConfirmDialog
        open={Boolean(bulk)}
        onClose={() => setBulk(null)}
        onConfirm={async () => {
          await applyBulk();
          setBulk(null);
        }}
        title={`Adjust ${bulk ? plural(bulk.length, 'product') : ''}`}
        confirmLabel="Record adjustments"
        danger={false}
        icon={SlidersHorizontal}
      >
        {bulk && (
          <>
            <p>Each product’s stock is moved by its counted difference, recorded as a stock correction with your name and a note referencing {data.countNumber}.</p>
            <ul className="mt-2 max-h-48 overflow-y-auto text-[13px]">
              {bulk.map((i) => (
                <li key={i.variantId} className="flex justify-between gap-3 py-0.5">
                  <span>{i.name}</span>
                  <b className={i.difference < 0 ? 'text-bad' : 'text-ok'}>
                    {i.difference > 0 ? '+' : ''}
                    {plural(i.difference, 'bottle')}
                  </b>
                </li>
              ))}
            </ul>
            <p className="mt-2">Can’t be edited later. Skip any product you’ve already adjusted.</p>
          </>
        )}
      </ConfirmDialog>

      <AdjustModal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        onDone={() => {
          if (adjusting) setApplied((a) => new Set([...a, adjusting.variantId]));
          reload();
        }}
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
