import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, Share2 } from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDate, fmtTime, money, PAYMENT_LABEL } from '../utils/format.js';

const Row = ({ children, className = '' }) => <div className={`flex justify-between gap-2.5 ${className}`}>{children}</div>;

/** Till receipt. ReceiptActions prints a copy of it that looks exactly like the screen. */
export function Receipt({ sale }) {
  const { business, shop } = useAuth();
  const adjustments = (sale.returnedAmount || 0) + (sale.refundedAmount || 0);
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
              {it.listPrice > it.unitPrice && <span className="text-[#b45309]"> (was {money(it.listPrice)})</span>}
            </span>
            <span>{money(it.lineTotal)}</span>
          </Row>
        </div>
      ))}
      <hr />
      {sale.totalDiscount > 0 && (
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
  const lines = sale.items.map((i) => `${i.variantName} ${i.quantity} ${i.unit}${i.quantity > 1 ? 's' : ''} ${money(i.lineTotal)}`);
  return [`${business?.name} receipt ${sale.receiptNumber}`, fmtDate(sale.createdAt), ...lines, `Total: ${money(sale.total)} (${PAYMENT_LABEL[sale.paymentMethod]})`].join('\n');
}

/** Print, Save as PDF (via the print dialog) and Share. */
export function ReceiptActions({ sale, size = 'md', className = '' }) {
  const { business } = useAuth();
  const toast = useToast();
  const [printing, setPrinting] = useState(false);
  const print = () => setPrinting(true);

  // Render a standalone copy of the receipt, print it, then remove it.
  // The page title becomes the PDF file name, e.g. "INV-000636.pdf".
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
  const share = async () => {
    const text = receiptText(sale, business);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${sale.receiptNumber}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success('Receipt copied. Paste it into WhatsApp or SMS.');
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Couldn’t share the receipt. Try printing it instead.');
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
      <Button size={size} icon={Printer} onClick={print}>
        Print
      </Button>
      <Button size={size} icon={Download} onClick={print} title="Choose “Save as PDF” in the print dialog">
        PDF
      </Button>
      <Button size={size} icon={Share2} onClick={share}>
        Share
      </Button>
    </div>
  );
}
