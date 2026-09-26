import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from './icons.js';
import { useNetworkStatus } from '../hooks/useNetworkStatus.js';
import { useSyncStatus } from '../hooks/useSyncStatus.js';
import { cn } from '../utils/cn.js';

/**
 * Small, deliberately quiet status pill: nothing shows when everything's synced and online,
 * since that's the normal state and staff shouldn't have to think about it (spec §17/§18).
 */
export function SyncIndicator({ shopId }) {
  const online = useNetworkStatus();
  const { pending, syncing, failed } = useSyncStatus(shopId);
  const navigate = useNavigate();
  const pill = 'flex h-10 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] font-semibold';

  if (failed > 0) {
    return (
      <button type="button" onClick={() => navigate('/staff/sales')} className={cn(pill, 'border-bad/25 bg-bad-soft text-bad')} title={`${failed} sale${failed > 1 ? 's need' : ' needs'} attention`}>
        <AlertTriangle size={13} />
        <span className="hidden sm:inline">{failed} needs attention</span>
      </button>
    );
  }
  if (!online || pending + syncing > 0) {
    return (
      <span className={cn(pill, 'border-line bg-surface text-ink-3')} title={!online ? 'Offline — sales are saved on this device' : 'Syncing sales to the server'}>
        {online ? <RotateCcw size={13} className="animate-spin" /> : <span className="size-1.5 rounded-full bg-ink-3" />}
        <span className="hidden sm:inline">{!online ? (pending ? `Offline · ${pending} pending` : 'Offline') : `Syncing ${pending + syncing}`}</span>
      </span>
    );
  }
  return null;
}
