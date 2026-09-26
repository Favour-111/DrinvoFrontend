import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Check, Lock, Mail, Pencil, Phone, Receipt, RotateCcw, ShieldCheck, Store } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card, CardHeader, MiniStat } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PaymentTag, SaleStatusBadge, StaffStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { Avatar } from '../../components/ui/Media.jsx';
import { ResetPasswordModal, StaffModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { staffService } from '../../services/index.js';
import { money, shortDateTime, timeAgo } from '../../utils/format.js';
import { useStaffStatus } from './Staff.jsx';

export default function StaffDetail() {
  const { id } = useParams();
  const { user: me, shop, shops } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => staffService.get(id), [id]);
  const status = useStaffStatus(reload);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton chart={false} />;
  const { user: u, stats, recentSales } = data;
  const isStaff = u.role === 'STAFF';
  const assignedShop = shops.find((s) => u.shopIds.includes(s.id)) || shop;
  const action = { PENDING: 'approve', ACTIVE: 'deactivate', INACTIVE: 'reactivate' }[u.status];
  const actionLabel = { approve: 'Approve', deactivate: 'Deactivate', reactivate: 'Reactivate' }[action];
  const actionIcon = { approve: Check, deactivate: Ban, reactivate: RotateCcw }[action];

  return (
    <Page>
      <PageHeader
        crumbs={[['Staff', '/admin/staff'], [u.name]]}
        subtitle={`${isStaff ? 'Staff' : 'Admin'} · ${assignedShop?.name} · last active ${u.lastActiveAt ? timeAgo(u.lastActiveAt) : 'never'}`}
        actions={
          <>
            <Button icon={Pencil} onClick={() => setModal('edit')}>
              Edit
            </Button>
            <Button icon={Lock} onClick={() => setModal('password')}>
              Reset password
            </Button>
            {u.id !== me.id && (
              <Button variant={action === 'deactivate' ? 'danger-soft' : 'secondary'} icon={actionIcon} onClick={() => status.ask(u)}>
                {actionLabel}
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={u} size={60} />
          <h1 className="text-[22px] font-bold sm:text-[24px]">{u.name}</h1>
          <StaffStatusBadge status={u.status} />
        </div>
        {u.status === 'PENDING' && <p className="mt-2.5 max-w-[520px] text-[13.5px] text-warn">This account signed up on its own and can’t sign in until you approve it.</p>}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Sales today" value={money(stats.todaySales)} />
        <MiniStat label="Transactions today" value={stats.todayTransactions} />
        <MiniStat label="Sales this month" value={money(stats.monthSales)} />
        <MiniStat label="Average sale today" value={money(stats.todayTransactions ? stats.todaySales / stats.todayTransactions : 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="self-start">
          <h3 className="mb-3.5 text-[16px] font-semibold">Account</h3>
          <div className="grid gap-3 text-[14px]">
            <div className="flex items-center gap-3"><Mail size={17} className="text-ink-3" />{u.email}</div>
            {u.phone && <div className="flex items-center gap-3"><Phone size={17} className="text-ink-3" /><span className="tnum">{u.phone}</span></div>}
            <div className="flex items-center gap-3"><Store size={17} className="text-ink-3" />{assignedShop?.name}</div>
            <div className="flex items-center gap-3"><ShieldCheck size={17} className="text-ink-3" />{isStaff ? 'Sell, view own sales, view stock' : 'Full access'}</div>
          </div>
        </Card>
        <Card flush>
          <CardHeader flush title="Recent sales" />
          {recentSales.length ? (
            <div className="overflow-x-auto">
              <table className="table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th className="num">Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="row-link" onClick={() => navigate(`/admin/sales/${s.id}`)}>
                      <td className="font-semibold">{s.receiptNumber}</td>
                      <td className="num font-semibold">{money(s.total)}</td>
                      <td><PaymentTag method={s.paymentMethod} /></td>
                      <td><SaleStatusBadge status={s.status} /></td>
                      <td className="text-ink-3">{shortDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Receipt} title="No sales yet" text="Sales recorded by this person will appear here." />
          )}
        </Card>
      </div>
      <StaffModal open={modal === 'edit'} onClose={() => setModal(null)} member={u} onDone={reload} />
      <ResetPasswordModal open={modal === 'password'} onClose={() => setModal(null)} member={u} />
      {status.dialog}
    </Page>
  );
}
