import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, MessageCircle, Printer } from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDate, fmtTime, money, PAYMENT_LABEL } from '../utils/format.js';
import { openWhatsApp } from '../utils/whatsapp.js';
import { buildReceiptPdf } from '../utils/receiptPdf.js';

const Row = ({ children, className = '' }) => <div className={`flex justify-between gap-2.5 ${className}`}>{children}</div>;

/** Till receipt. ReceiptActions prints a copy of it that looks exactly like the screen. */
export function Receipt({ sale }) {
  const { business, shop } = useAuth();
  const adjustments = (sale.returnedAmount || 0) + (sale.refundedAmount || 0);
  // Admin-configurable: customers don't always need to see that a discount was applied.
  // This only affects what's printed/shared here — admin sale records always show it in full.
  const showDiscount = business?.showDiscountOnReceipt !== false;
  return (
    <div className="receipt">
      <div className="text-center">
        <div className="font-sans text-[13px] font-extrabold tracking-[0.28em] text-[#047857]">DRINVO</div>
        <div className="mt-2 text-[14px] font-semibold">{business?.name}</div>
        <div className="text-[#6b716b]">{shop?.name}</div>
        {shop?.address && <div className="text-[11px] text-[#6b716b]">{shop.address}</div>}
      </div>
      <hr />
      <Row>
        <span>Receipt</span>
        <b>{sale.receiptNumber}</b>
      </Row>
      <Row>
        <span>Date</span>
        <span>{fmtDate(sale.createdAt)}</span>
      </Row>
      <Row>
        <span>Time</span>
        <span>{fmtTime(sale.createdAt)}</span>
      </Row>
      <hr />
      {sale.items.map((it) => (
        <div key={it.id} className="mb-2.5">
          <div>{it.variantName}</div>
          <Row className="text-[#5f665f]">
            <span>
              {it.quantity} {it.unit}
              {it.quantity > 1 ? 's' : ''} × {money(it.unitPrice)}
              {showDiscount && it.listPrice > it.unitPrice && <span className="text-[#b45309]"> (was {money(it.listPrice)})</span>}
            </span>
            <span>{money(it.lineTotal)}</span>
          </Row>
        </div>
      ))}
      <hr />
      {showDiscount && sale.totalDiscount > 0 && (
        <Row className="text-[#b45309]">
          <span>Discount</span>
          <span>−{money(sale.totalDiscount)}</span>
        </Row>
      )}
      <Row className="text-[15px] font-semibold">
        <span>TOTAL</span>
        <span>{money(sale.total)}</span>
      </Row>
      {adjustments > 0 && (
        <>
          <Row>
            <span>Returned/refunded</span>
            <span>−{money(adjustments)}</span>
          </Row>
          <Row className="font-semibold">
            <span>NET</span>
            <span>{money(sale.netTotal)}</span>
          </Row>
        </>
      )}
      <Row className="mt-2">
        <span>Payment</span>
        <span>{PAYMENT_LABEL[sale.paymentMethod]}</span>
      </Row>
      {sale.paymentMethod === 'PART' && (
        <Row>
          <span>Paid now ({PAYMENT_LABEL[sale.paidWith]})</span>
          <span>{money(sale.amountPaid)}</span>
        </Row>
      )}
      {sale.balanceAtSale > 0 && sale.status !== 'VOIDED' && (
        <Row className="font-semibold">
          <span>Balance owed</span>
          <span>{money(sale.balanceAtSale)}</span>
        </Row>
      )}
      {sale.customer && (
        <Row>
          <span>Customer</span>
          <span>{sale.customer.name}</span>
        </Row>
      )}
      {business?.showStaffOnReceipt !== false && sale.staff && (
        <Row>
          <span>Served by</span>
          <span>{sale.staff.name.split(' ')[0]}</span>
        </Row>
      )}
      {sale.status === 'VOIDED' && (
        <>
          <hr />
          <div className="text-center font-semibold text-[#c62828]">VOIDED</div>
        </>
      )}
      <hr />
      <div className="text-center">{business?.receiptFooter}</div>
      <div className="rc-bar" />
    </div>
  );
}

export function receiptText(sale, business) {
  const lines = sale.items.map((i) => `${i.variantName} — ${i.quantity} ${i.unit}${i.quantity > 1 ? 's' : ''} × ${money(i.unitPrice)} = ${money(i.lineTotal)}`);
  return [`*${business?.name}*`, `Receipt ${sale.receiptNumber}`, fmtDate(sale.createdAt), '', ...lines, '', `*Total: ${money(sale.total)}* (${PAYMENT_LABEL[sale.paymentMethod]})`].join('\n');
}

/** Print, download an actual PDF, and send that PDF on WhatsApp. */
export function ReceiptActions({ sale, size = 'md', className = '' }) {
  const toast = useToast();
  const [printing, setPrinting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef(null);
  const print = () => setPrinting(true);

  // Render a standalone copy of the receipt, print it, then remove it.
  useEffect(() => {
    if (!printing) return undefined;
    const title = document.title;
    document.title = sale.receiptNumber;
    const done = () => {
      document.title = title;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      document.title = title;
    };
  }, [printing, sale.receiptNumber]);

  // A hidden, off-screen (not display:none — html2canvas needs real layout) copy of the receipt,
  // captured exactly as it renders — same font, same everything — then dropped straight into a PDF
  // sized to just that content plus a paper margin, never a full blank A4 sheet.
  const capturePdf = async () => {
    setCapturing(true);
    // A timer, not requestAnimationFrame — shareWhatsApp() below opens a new tab first (to avoid
    // the popup blocker), which backgrounds this tab, and most browsers throttle or fully suspend
    // rAF callbacks for background tabs. That would stall this wait forever; a timer still fires.
    await new Promise((r) => setTimeout(r, 50));
    try {
      return await buildReceiptPdf(captureRef.current, sale.receiptNumber);
    } finally {
      setCapturing(false);
    }
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const { pdf, filename } = await capturePdf();
      pdf.save(filename);
    } catch {
      toast.error('Couldn’t build the PDF. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Shares the actual PDF file where the browser supports it (most phones). Where it doesn't —
  // mainly desktop browsers, which can't attach files to a WhatsApp chat at all — it downloads the
  // PDF and opens WhatsApp (pre-addressed to the customer on file, if there is one) so it can be
  // attached by hand; there's no way to pre-attach a file via a WhatsApp link.
  const shareWhatsApp = async () => {
    setBusy(true);
    // Opened synchronously, right here in the click handler, so it's never blocked as a popup —
    // everything after this point is async (PDF capture, then possibly a multi-second wait on
    // navigator.share), and window.open() called that late is unreliable in most browsers. This
    // tab gets closed if native sharing takes over, or redirected to WhatsApp if we fall back to it.
    const tab = window.open('', '_blank');
    try {
      const { pdf, blob, filename } = await capturePdf();
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          // navigator.share with files is known to just hang on some desktop browsers (Chrome on
          // macOS in particular) instead of resolving or rejecting — a bare `await` here would
          // leave the button stuck "loading" forever with no way out. Racing it against a timeout
          // guarantees we always move on to the reliable fallback below instead of hanging.
          await Promise.race([
            navigator.share({ files: [file], title: `Receipt ${sale.receiptNumber}` }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('share-timeout')), 4000)),
          ]);
          tab?.close();
          return;
        } catch (err) {
          if (err?.name === 'AbortError') {
            tab?.close(); // user closed the native share sheet themselves
            return;
          }
          // anything else — including our own timeout — falls through to the fallback below
        }
      }
      pdf.save(filename);
      toast.success('Receipt PDF downloaded — attach it to the WhatsApp chat that just opened.');
      openWhatsApp(`Receipt ${sale.receiptNumber} — see the attached PDF.`, sale.customer?.phone, tab);
    } catch {
      tab?.close();
      toast.error('Couldn’t build the PDF. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {printing &&
        createPortal(
          <div id="print-root">
            <div className="print-sheet">
              <Receipt sale={sale} />
            </div>
          </div>,
          document.body
        )}
      {capturing &&
        createPortal(
          <div style={{ position: 'fixed', top: 0, left: '-9999px', background: '#ffffff' }}>
            <div ref={captureRef}>
              <Receipt sale={sale} />
            </div>
          </div>,
          document.body
        )}
      <Button size={size} icon={Printer} onClick={print}>
        Print
      </Button>
      <Button size={size} icon={Download} loading={busy} onClick={downloadPdf}>
        PDF
      </Button>
      <Button size={size} icon={MessageCircle} loading={busy} onClick={shareWhatsApp}>
        WhatsApp
      </Button>
    </div>
  );
}
