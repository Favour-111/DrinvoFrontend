import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

const WIDTHS = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' };

export function Modal({ open, onClose, title, description, size = 'md', children, footer }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement;
    setTimeout(() => panel.current?.querySelector('input,select,textarea,button:not([aria-label="Close"])')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="animate-fade fixed inset-0 z-[100] grid items-end bg-scrim p-3 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('animate-pop mx-auto flex max-h-[calc(100dvh-24px)] w-full flex-col rounded-panel border border-line bg-surface shadow-pop', WIDTHS[size])}
      >
        <div className="flex items-start justify-between gap-3 px-[22px] pt-[22px] pb-1.5">
          <div>
            <h2 className="text-[18px] font-bold">{title}</h2>
            {description && <p className="mt-1 text-[13.5px] text-ink-3">{description}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 flex-none place-items-center rounded-[10px] border border-line text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <X size={17} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5 overflow-auto px-[22px] pt-3.5 pb-[18px]">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line-2 px-[22px] pt-3.5 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Confirmation for destructive or irreversible actions.
 * `onConfirm` may return a promise; the dialog shows a spinner and closes on success.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = true, icon: Icon = AlertTriangle }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      /* caller shows the error */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span className={cn('grid size-[42px] flex-none place-items-center rounded-[12px]', danger ? 'bg-bad-soft text-bad' : 'bg-brand-soft text-brand')}>
          <Icon size={21} />
        </span>
        <div className="flex flex-col gap-2 text-[14px] text-ink-2">{children}</div>
      </div>
    </Modal>
  );
}
