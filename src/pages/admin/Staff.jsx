import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Check, Eye, Pencil, Plus, RotateCcw } from '../../components/icons.js';
import { Page, PageHeader } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { StaffStatusBadge, Tag } from '../../components/ui/Badge.jsx';
import { ErrorState, PageSkeleton } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Media.jsx';
import { StaffModal } from '../../components/modals/EntityModals.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { staffService } from '../../services/index.js';
import { money, timeAgo } from '../../utils/format.js';

const STATUS_ACTION = { PENDING: 'approve', ACTIVE: 'deactivate', INACTIVE: 'reactivate' };
const ACTION_COPY = {
  approve: { label: 'Approve', icon: Check, danger: false, toast: 'Staff approved. They can now sign in.', body: (n) => <p>{n} will be able to sign in and record sales.</p> },
  deactivate: {
    label: 'Deactivate',
    icon: Ban,
    danger: true,
    toast: 'Staff deactivated.',
    body: (n) => (
      <>
        <p>{n} will be signed out and won’t be able to sign in or record sales.</p>
        <p>Their past sales stay in history.</p>
      </>
    ),
  },
  reactivate: { label: 'Reactivate', icon: RotateCcw, danger: false, toast: 'Staff reactivated.', body: (n) => <p>{n} will be able to sign in and record sales again.</p> },
};

export function useStaffStatus(onDone) {
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const action = target && STATUS_ACTION[target.status];
  const copy = action && ACTION_COPY[action];
  const run = async () => {
    try {
      await (action === 'deactivate' ? staffService.deactivate(target.id) : staffService.activate(target.id));
      toast.success(copy.toast);
      onDone?.();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };
  const dialog = (
    <ConfirmDialog open={Boolean(target)} onClose={() => setTarget(null)} onConfirm={run} title={target ? `${copy.label} ${target.name}?` : ''} confirmLabel={copy?.label} danger={copy?.danger} icon={copy?.icon}>
      {target && copy.body(target.name.split(' ')[0])}
    </ConfirmDialog>
  );
  return { ask: setTarget, dialog };
}

export default function Staff() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const { data, error, reload } = useApi(() => staffService.list(), []);
  const status = useStaffStatus(reload);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  return (
    <Page>
      <PageHeader
        title="Staff"
        subtitle={`${data.filter((u) => u.status === 'ACTIVE').length} active accounts${data.filter((u) => u.status === 'PENDING').length ? ` · ${data.filter((u) => u.status === 'PENDING').length} awaiting approval` : ''}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setModal({})}>
            Add Staff
          </Button>
        }
      />
      <Card flush>
        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Status</th>
                <th className="num">Sales Today</th>
                <th className="num">Sales This Month</th>
                <th>Last Active</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="row-link" onClick={() => navigate(`/admin/staff/${u.id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={36} />
                      <div>
                        <b className="block font-semibold">
                          {u.name}
                          {u.id === user.id && <span className="font-normal text-ink-3"> (you)</span>}
                        </b>
                        <small className="text-[12px] text-ink-3">{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Tag>{u.role === 'ADMIN' ? 'Admin' : 'Staff'}</Tag>
                  </td>
                  <td>
                    <StaffStatusBadge status={u.status} />
                  </td>
                  <td className="num">
                    <b>{money(u.todaySales)}</b>
                    <br />
                    <small className="text-ink-3">{u.todayTransactions} transactions</small>
                  </td>
                  <td className="num">{money(u.monthSales)}</td>
                  <td className="text-ink-3">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : 'Never'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <IconButton size={32} icon={Eye} label="View" onClick={() => navigate(`/admin/staff/${u.id}`)} />
                      <IconButton size={32} icon={Pencil} label="Edit" onClick={() => setModal(u)} />
                      {u.id !== user.id && (
                        <IconButton
                          size={32}
                          icon={u.status === 'PENDING' ? Check : u.status === 'ACTIVE' ? Ban : RotateCcw}
                          label={u.status === 'PENDING' ? 'Approve' : u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                          onClick={() => status.ask(u)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <StaffModal open={Boolean(modal)} onClose={() => setModal(null)} member={modal?.id ? modal : null} onDone={reload} />
      {status.dialog}
    </Page>
  );
}
