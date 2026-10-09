import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from '../icons.js';
import { cn } from '../../utils/cn.js';

/**
 * A searchable dropdown: type in the field to filter, click or Enter to pick.
 * The popup renders in a portal (not inside the trigger's DOM position) so it
 * isn't clipped by a Modal's scrolling container, the way an absolutely
 * positioned child of `overflow-auto` content would be.
 *
 * `options`: [{ value, label, group?, sublabel?, disabled? }]
 */
export function Combobox({ id, value, onChange, options, placeholder = 'Search…', emptyText = 'Nothing found', disabled, error, className }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle) || o.group?.toLowerCase().includes(needle) || o.sublabel?.toLowerCase().includes(needle));
  }, [options, q]);

  // Groups rendered in first-seen order; ungrouped options share a single unlabeled bucket.
  const groups = useMemo(() => {
    const map = new Map();
    for (const o of filtered) {
      const key = o.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()];
  }, [filtered]);

  const close = () => {
    setOpen(false);
    setQ('');
  };
  const openPopup = () => {
    if (disabled) return;
    setRect(triggerRef.current.getBoundingClientRect());
    setActive(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    // Repositioning on scroll is unnecessary complexity for a short-lived popup — closing is simpler and avoids a stale, floating panel.
    const onScroll = (e) => {
      if (popupRef.current?.contains(e.target)) return;
      close();
    };
    const onClick = (e) => {
      if (popupRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const pick = (opt) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setQ('');
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQ('');
      close();
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
  };

  return (
    <>
      <div className="relative">
        <input
          type="text"
          id={id}
          ref={triggerRef}
          disabled={disabled}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-invalid={error ? 'true' : undefined}
          value={open ? q : selected ? selected.label : ''}
          placeholder={open && selected ? selected.label : placeholder}
          onFocus={openPopup}
          onClick={() => !open && openPopup()}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            if (!open) openPopup();
          }}
          onKeyDown={onKeyDown}
          className={cn('input truncate pr-9 disabled:opacity-50', className)}
        />
        <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
      </div>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popupRef}
            role="listbox"
            style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220), maxWidth: 'calc(100vw - 24px)' }}
            onMouseDown={(e) => e.preventDefault()}
            className="animate-pop z-[200] flex max-h-72 flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-pop"
          >
            <div className="scrollbar-none overflow-y-auto py-1">
              {groups.length ? (
                groups.map(([group, opts]) => (
                  <div key={group || '_'}>
                    {group && <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{group}</div>}
                    {opts.map((o) => {
                      const i = filtered.indexOf(o);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="option"
                          aria-selected={o.value === value}
                          disabled={o.disabled}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => pick(o)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] transition-colors',
                            o.disabled ? 'cursor-not-allowed opacity-40' : i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          {o.sublabel && <span className="flex-none text-[12px] text-ink-3">{o.sublabel}</span>}
                          {o.value === value && <Check size={14} className="flex-none text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-[13px] text-ink-3">{emptyText}</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
