import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { SaleStatusBadge } from '../../components/ui/Badge.jsx';
import { SyncStatusTag } from '../../components/SyncStatusTag.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Receipt, ReceiptActions } from '../../components/Receipt.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getLocalSale } from '../../offline/localSales.js';
import { subscribeSync } from '../../offline/syncManager.js';
import { salesService } from '../../services/index.js';
import { fmtDateTime } from '../../utils/format.js';

export default function MySale() {
  const { id } = useParams();
  const { shop } = useAuth();
  const isLocal = id.startsWith('LOCAL-');
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (isLocal) {
      if (!shop?.id) return;
      getLocalSale(shop.id, id).then((row) => (row ? setS(row) : setError(new Error('That sale isn’t on this device.'))));
    } else {
      salesService.get(id).then(setS).catch(setError);
    }
  };

  useEffect(load, [id, shop?.id, isLocal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (isLocal && shop?.id ? subscribeSync(shop.id, load) : undefined), [isLocal, shop?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !s) return <ErrorState error={error} onRetry={load} />;
  if (!s) return <PageSkeleton stats={0} chart={false} />;
  return (
    <Page className="mx-auto w-full max-w-[560px]">
      <PageHeader
        crumbs={[['My Sales', '/staff/sales'], [s.receiptNumber]]}
        subtitle={fmtDateTime(s.createdAt)}
        actions={s.syncStatus ? <SyncStatusTag status={s.syncStatus} /> : <SaleStatusBadge status={s.status} />}
      >
        <h1 className="tnum text-[22px] font-bold">{s.receiptNumber}</h1>
      </PageHeader>
      {s.syncStatus === 'FAILED' && (
        <div className="rounded-[14px] border border-bad/20 bg-bad-soft px-4 py-3 text-[13.5px] text-bad">
          <b className="block font-semibold">This sale could not be completed on the server.</b>
          {s.error || 'It was saved on this device only. Ask an admin to review it.'}
        </div>
      )}
      <div>
        <Receipt sale={s} />
      </div>
      <ReceiptActions sale={s} className="mt-2.5" />
    </Page>
  );
}
