import { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator as CalculatorIcon, Delete, X } from './icons.js';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '../utils/cn.js';

const POS_KEY = 'drinvo.calc.pos';
const BTN = 56; // FAB diameter
const PANEL_W = 288;
const PANEL_H = 396;
const MARGIN = 10;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function loadPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultPos() {
  return { x: window.innerWidth - BTN - 18, y: window.innerHeight - BTN - 150 };
}

const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function compute(a, b, op) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatResult(n) {
  if (!Number.isFinite(n)) return 'Error';
  // Round off float noise (0.1 + 0.2 -> 0.30000000000000004) without losing real precision
  const rounded = Math.round((n + Number.EPSILON) * 1e9) / 1e9;
  return String(rounded);
}

/** Adds thousand separators to the integer part for display only — the raw string stays exact for input/math. */
function formatDisplay(raw) {
  if (raw === 'Error') return raw;
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split('.');
  const withCommas = Number(intPart || '0').toLocaleString('en-US');
  return (neg ? '−' : '') + withCommas + (decPart !== undefined ? `.${decPart}` : '');
}

/** A real calculator engine (chained operators, live pending-op display) — not a naive eval(). */
function useCalculatorEngine() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [operator, setOperator] = useState(null);
  const [overwrite, setOverwrite] = useState(true);
  const [error, setError] = useState(false);

  const inputDigit = (d) => {
    if (error) {
      setDisplay(d);
      setError(false);
      setOverwrite(false);
      return;
    }
    setDisplay((cur) => {
      if (overwrite) return d;
      if (cur === '0') return d;
      if (cur.replace('-', '').replace('.', '').length >= 12) return cur;
      return cur + d;
    });
    setOverwrite(false);
  };

  const inputDecimal = () => {
    if (error) return;
    setDisplay((cur) => (overwrite ? '0.' : cur.includes('.') ? cur : `${cur}.`));
    setOverwrite(false);
  };

  const chooseOperator = (op) => {
    if (error) return;
    const current = Number.parseFloat(display);
    if (operator != null && !overwrite) {
      const result = compute(prev, current, operator);
      if (!Number.isFinite(result)) {
        setDisplay('Error');
        setError(true);
        setPrev(null);
        setOperator(null);
        setOverwrite(true);
        return;
      }
      setDisplay(formatResult(result));
      setPrev(result);
    } else {
      setPrev(current);
    }
    setOperator(op);
    setOverwrite(true);
  };

  const equals = () => {
    if (error || operator == null || prev == null) return;
    const current = Number.parseFloat(display);
    const result = compute(prev, current, operator);
    setDisplay(formatResult(result));
    setError(!Number.isFinite(result));
    setPrev(null);
    setOperator(null);
    setOverwrite(true);
  };

  const clear = () => {
    setDisplay('0');
    setPrev(null);
    setOperator(null);
    setOverwrite(true);
    setError(false);
  };

  const backspace = () => {
    if (error) return clear();
    if (overwrite) return;
    setDisplay((cur) => {
      const next = cur.slice(0, -1);
      if (next === '' || next === '-') return '0';
      return next;
    });
  };

  return { display, operator, prev, inputDigit, inputDecimal, chooseOperator, equals, clear, backspace };
}

function CalculatorPanel({ pos, onClose }) {
  const ref = useRef(null);
  const calc = useCalculatorEngine();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose();
      if (e.key >= '0' && e.key <= '9') return calc.inputDigit(e.key);
      if (e.key === '.') return calc.inputDecimal();
      if (e.key === '+' || e.key === '-') return calc.chooseOperator(e.key);
      if (e.key === '*' || e.key === '/') return calc.chooseOperator(e.key);
      if (e.key === 'Enter' || e.key === '=') return calc.equals();
      if (e.key === 'Backspace') return calc.backspace();
      if (e.key.toLowerCase() === 'c') return calc.clear();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    // The FAB has its own open/close toggle — if this handler also closed on a tap that lands
    // there, the two state updates would race and the panel could flip straight back open.
    const onDown = (e) => !ref.current?.contains(e.target) && !e.target.closest('[data-calc-fab]') && onClose();
    // Skip the opening tap itself
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  // Anchor near the button, but keep the whole panel on-screen regardless of where it's parked.
  const openLeft = pos.x + BTN / 2 > window.innerWidth / 2;
  const openUp = pos.y + BTN / 2 > window.innerHeight / 2;
  const left = clamp(openLeft ? pos.x + BTN - PANEL_W : pos.x, MARGIN, window.innerWidth - PANEL_W - MARGIN);
  const top = clamp(openUp ? pos.y - PANEL_H - 10 : pos.y + BTN + 10, MARGIN, window.innerHeight - PANEL_H - MARGIN);

  const digit = (label, onClick, className) => (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-11 rounded-[12px] text-[16px] font-semibold text-ink transition-colors active:scale-[0.96] bg-surface-2 hover:bg-surface-3', className)}
    >
      {label}
    </button>
  );
  const op = (symbol, key) => (
    <button
      type="button"
      onClick={() => calc.chooseOperator(key)}
      className={cn(
        'h-11 rounded-[12px] text-[17px] font-bold transition-colors active:scale-[0.96]',
        calc.operator === key ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand-ink hover:bg-brand-soft/70'
      )}
    >
      {symbol}
    </button>
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Calculator"
      style={{ left, top, width: PANEL_W }}
      className="animate-pop fixed z-[90] rounded-[20px] border border-line bg-surface p-3.5 shadow-pop"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          <CalculatorIcon size={14} />
          Calculator
        </span>
        <button type="button" aria-label="Close calculator" onClick={onClose} className="grid size-7 place-items-center rounded-[9px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
          <X size={15} />
        </button>
      </div>

      <div className="mb-3 rounded-[14px] border border-line-2 bg-surface-2 px-3.5 py-3 text-right">
        <div className="h-4 truncate text-[12px] text-ink-3">
          {calc.prev != null && calc.operator ? `${formatDisplay(formatResult(calc.prev))} ${OP_LABEL[calc.operator]}` : ' '}
        </div>
        <div className="tnum truncate text-[28px] font-bold text-ink">{formatDisplay(calc.display)}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {digit('C', calc.clear, 'text-bad bg-bad-soft hover:bg-bad-soft/70')}
        {digit(<Delete size={17} className="mx-auto" />, calc.backspace)}
        <span />
        {op('÷', '/')}

        {digit('7', () => calc.inputDigit('7'))}
        {digit('8', () => calc.inputDigit('8'))}
        {digit('9', () => calc.inputDigit('9'))}
        {op('×', '*')}

        {digit('4', () => calc.inputDigit('4'))}
        {digit('5', () => calc.inputDigit('5'))}
        {digit('6', () => calc.inputDigit('6'))}
        {op('−', '-')}

        {digit('1', () => calc.inputDigit('1'))}
        {digit('2', () => calc.inputDigit('2'))}
        {digit('3', () => calc.inputDigit('3'))}
        {op('+', '+')}

        {digit('0', () => calc.inputDigit('0'), 'col-span-2')}
        {digit('.', calc.inputDecimal)}
        <button type="button" onClick={calc.equals} className="h-11 rounded-[12px] bg-brand text-[18px] font-bold text-on-brand transition-colors hover:bg-brand-2 active:scale-[0.96]">
          =
        </button>
      </div>
    </div>
  );
}

/** Draggable floating calculator, available on every signed-in page (admin and staff alike). */
export function FloatingCalculator() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const drag = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    setPos(loadPos() || defaultPos());
  }, []);

  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? { x: clamp(p.x, MARGIN, window.innerWidth - BTN - MARGIN), y: clamp(p.y, MARGIN, window.innerHeight - BTN - MARGIN) } : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pos]);

  // Window-level listeners (attached only while dragging) rather than setPointerCapture — plain,
  // widely-supported, and unaffected by capture edge cases across browsers/input devices.
  const onPointerDown = useCallback(
    (e) => {
      if (!pos) return;
      drag.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

      const onMove = (ev) => {
        const d = drag.current;
        if (!d.dragging) return;
        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true;
        if (d.moved) {
          setPos({ x: clamp(d.origX + dx, MARGIN, window.innerWidth - BTN - MARGIN), y: clamp(d.origY + dy, MARGIN, window.innerHeight - BTN - MARGIN) });
        }
      };
      const onUp = () => {
        const d = drag.current;
        d.dragging = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!d.moved) {
          setOpen((o) => !o);
        } else {
          setPos((p) => {
            try {
              localStorage.setItem(POS_KEY, JSON.stringify(p));
            } catch {
              /* ignore */
            }
            return p;
          });
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [pos]
  );

  if (status !== 'ready' || !pos) return null;

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close calculator' : 'Open calculator'}
        data-calc-fab
        onPointerDown={onPointerDown}
        style={{ left: pos.x, top: pos.y, width: BTN, height: BTN, touchAction: 'none' }}
        className={cn(
          'fixed z-[90] grid place-items-center rounded-full shadow-pop ring-4 ring-surface transition-colors',
          open ? 'bg-ink text-surface-solid' : 'bg-brand text-on-brand hover:bg-brand-2'
        )}
      >
        {open ? <X size={22} /> : <CalculatorIcon size={22} />}
      </button>
      {open && <CalculatorPanel pos={pos} onClose={() => setOpen(false)} />}
    </>
  );
}
