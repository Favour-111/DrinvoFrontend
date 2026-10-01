import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Plus } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Form.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { TransferModal } from '../../components/modals/StockModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { transferService } from '../../services/index.js';
import { fmtDateTime, plural, shortDateTime } from '../../utils/format.js';

const STATUS_TONE = { PENDING: 'warn', COMPLETED: 'ok', CANCELLED: 'neutral' };
const EMPTY = { shopId: '', status: '', range: 'all' };

function TransferDetailModal({ transferId, onClose }) {
  const { data } = useApi(() => (transferId ? transferService.get(transferId) : Promise.resolve(null)), [transferId]);
  if (!transferId) return null;
  return (
    <Modal open={Boolean(transferId)} onClose={onClose} title={data ? data.transferNumber : 'Transfer'} size="md">
      {!data ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-3 rounded-[16px] border border-line-2 bg-surface-2 px-4 py-3.5 text-[14px] font-semibold">
            <span>{data.fromShop?.name}</span>
            <ArrowRight size={16} className="text-ink-3" />
            <span>{data.toShop?.name}</span>
          </div>
          <div className="flex items-center justify-between text-[13.5px]">
            <span className="text-ink-3">Status</span>
            <Badge tone={STATUS_TONE[data.status]}>{data.status}</Badge>
          </div>
          <div>
            <div className="label mb-1.5">Items</div>
            <div className="flex flex-col gap-2">
              {data.items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-[12px] border border-line-2 bg-surface-2 px-3.5 py-2.5 text-[13.5px]">
                  <span className="font-medium">{i.name}</span>
                  <span className="tnum text-ink-2">
                    {plural(i.quantity, i.unit)} <small className="text-ink-3">= {plural(i.baseQuantity, 'bottle')}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[16px] border border-line-2 bg-surface-2 p-3.5">
            <div className="label mb-1.5">Inventory impact</div>
            <div className="flex items-center justify-between text-[13.5px]">
              <span>{data.fromShop?.name}</span>
              <b className="tnum text-bad">−{plural(data.totalBaseQuantity, 'bottle')}</b>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[13.5px]">
              <span>{data.toShop?.name}</span>
              <b className="tnum text-ok">+{plural(data.totalBaseQuantity, 'bottle')}</b>
            </div>
          </div>
          {data.notes && (
            <div>
              <div className="label mb-1">Notes</div>
              <p className="text-[13.5px] text-ink-2">{data.notes}</p>
            </div>
          )}
          <div className="flex items-center justify-between text-[12.5px] text-ink-3">
            <span>Created by {data.createdBy?.name}</span>
            <span>{fmtDateTime(data.createdAt)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Transfers() {
  const { shops } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const { data, error, loading, reload } = useApi(() => transferService.list({ ...f, page, limit: 30 }), [f.shopId, f.status, f.range, page]);

  const set = (patch) => {
    setPage(1);
    setF((x) => ({ ...x, ...patch }));
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;

  const totalIn = data.items.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.totalBaseQuantity, 0);

  return (
    <Page>
      <PageHeader
        title="Stock Transfers"
        subtitle="Move inventory between your shops and keep stock synchronized."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)} disabled={shops.length < 2}>
            New Transfer
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Transfers" value={data.total} />
        <MiniStat label="Bottles moved" value={totalIn} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {[
          ['shopId', 'Shop', [['', 'All shops'], ...shops.map((s) => [s.id, s.name])]],
          ['status', 'Status', [['', 'All statuses'], ['PENDING', 'Pending'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']]],
          ['range', 'Date', [['all', 'All time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month']]],
        ].map(([key, label, opts]) => (
          <Select key={key} aria-label={label} value={f[key]} onChange={(e) => set({ [key]: e.target.value })} className="w-auto min-w-[140px] flex-1 sm:flex-none">
            {opts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        ))}
      </div>

      <Card flush>
        {data.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Transfer No.</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.items.map((t) => (
                    <tr key={t.id} className="row-link" onClick={() => setViewing(t.id)}>
                      <td className="tnum font-semibold">{t.transferNumber}</td>
                      <td>{t.fromShop?.name}</td>
                      <td>{t.toShop?.name}</td>
                      <td>{plural(t.itemCount, 'item')}</td>
                      <td>
                        <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                      </td>
                      <td>{t.createdBy?.name}</td>
                      <td className="text-ink-3">{shortDateTime(t.createdAt)}</td>
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={() => setViewing(t.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-[13px] text-ink-3">
                <span>
                  Page {data.page} of {data.pages} · {data.total} transfers
                </span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers yet"
            text={shops.length < 2 ? 'Add a second shop to start moving stock between locations.' : 'Move stock between your shops and it will show up here.'}
            action={
              shops.length >= 2 && (
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  New Transfer
                </Button>
              )
            }
          />
        )}
      </Card>

      <TransferModal open={creating} onClose={() => setCreating(false)} onDone={reload} />
      <TransferDetailModal transferId={viewing} onClose={() => setViewing(null)} />
    </Page>
  );
}
