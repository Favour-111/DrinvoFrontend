import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

const WIDTHS = { sm: 'max-w-[440px]', md: 'max-w-[580px]', lg: 'max-w-[780px]' };

/** Colour family for a modal's header tile and decorative blob. Destructive modals use the restrained red. */
const TONE = {
  brand: { tile: 'tile-brand', blob: 'bg-brand-3' },
  bad: { tile: 'tile-bad', blob: 'bg-bad' },
  warn: { tile: 'tile-warn', blob: 'bg-warn' },
  info: { tile: 'tile-info', blob: 'bg-info' },
  profit: { tile: 'tile-profit', blob: 'bg-profit' },
};

/**
 * The one modal shell every dialog in the app uses: an icon tile beside a strong title, a soft
 * decorative blob in the corner, scrollable content and a tinted footer band for actions.
 */
export function Modal({ open, onClose, title, description, icon: Icon, tone = 'brand', size = 'md', children, footer, className }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const t = TONE[tone] || TONE.brand;

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
    <div className="animate-fade fixed inset-0 z-[100] grid items-end bg-scrim p-2.5 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('animate-pop relative mx-auto flex max-h-[calc(100dvh-20px)] w-full flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-pop', WIDTHS[size], className)}
      >
        <span className={cn('blob -top-20 -right-16 size-56 opacity-[0.16]', t.blob)} aria-hidden="true" />
        <div className="relative flex items-start gap-4 px-6 pt-6 pb-4">
          {Icon && (
            <span className={cn('tile size-12 flex-none rounded-[15px]', t.tile)}>
              <Icon size={22} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[19px] leading-tight font-bold tracking-[-0.015em]">{title}</h2>
            {description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 flex-none place-items-center rounded-[11px] border border-line bg-surface text-ink-2 shadow-[0_1px_2px_rgba(16,24,32,0.04)] transition-all duration-150 hover:border-ink-3/30 hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pt-1 pb-6">{children}</div>
        {footer && (
          <div className="relative flex flex-wrap items-center justify-end gap-2.5 border-t border-line-2 bg-surface-2/70 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** A clearly grouped block inside a modal — light tinted, rounded, with an optional labelled header. */
export function ModalSection({ title, icon: Icon, hint, action, children, className, tone = 'neutral' }) {
  return (
    <section className={cn('rounded-[18px] border border-line-2 bg-surface-2/60 p-4 sm:p-5', tone === 'brand' && 'border-brand/15 bg-brand-soft/40', className)}>
      {(title || action) && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="grid size-7 place-items-center rounded-[9px] bg-surface text-brand shadow-[inset_0_0_0_1px_var(--line)]">
                <Icon size={14} />
              </span>
            )}
            <span className="text-[13.5px] font-semibold">{title}</span>
            {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Subtle tinted banner used for a summary line or an important note inside a modal. */
export function ModalNote({ icon: Icon, tone = 'brand', children, className }) {
  const tones = {
    brand: 'border-brand/20 bg-brand-soft/60 text-brand-ink',
    warn: 'border-warn/25 bg-warn-soft text-warn',
    bad: 'border-bad/25 bg-bad-soft text-bad',
    info: 'border-info/25 bg-info-soft text-info',
  };
  return (
    <div className={cn('flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-[13px] leading-relaxed', tones[tone], className)}>
      {Icon && <Icon size={16} className="mt-px flex-none" />}
      <div className="min-w-0 text-ink-2 [&_b]:font-semibold [&_b]:text-ink">{children}</div>
    </div>
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
      icon={Icon}
      tone={danger ? 'bad' : 'brand'}
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
      <div className="text-[14px] leading-relaxed text-ink-2 [&_p+p]:mt-2.5">{children}</div>
    </Modal>
  );
}
