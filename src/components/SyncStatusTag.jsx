import { AlertTriangle, Check, Clock, RotateCcw } from './icons.js';
import { Badge } from './ui/Badge.jsx';

const SYNC_STATUS = {
  SYNCED: { tone: 'ok', label: 'Synced', icon: Check },
  SYNCING: { tone: 'info', label: 'Syncing…', icon: RotateCcw },
  PENDING: { tone: 'warn', label: 'Waiting for connection', icon: Clock },
  FAILED: { tone: 'bad', label: 'Needs attention', icon: AlertTriangle },
};

/** Small status pill for a locally-queued sale: PENDING → SYNCING → SYNCED (or FAILED). */
export function SyncStatusTag({ status, className }) {
  const s = SYNC_STATUS[status];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} dot={false} className={className}>
      <Icon size={11} className={status === 'SYNCING' ? 'animate-spin' : ''} />
      {s.label}
    </Badge>
  );
}
