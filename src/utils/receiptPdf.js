/**
 * Rasterizes an already-mounted `.receipt` DOM node into a PDF sized to just that content plus a
 * comfortable paper margin — not a full A4 sheet with mostly blank space below a short receipt.
 * A raster capture (rather than jsPDF's own HTML renderer) guarantees the PDF shows exactly what's
 * on screen, in the receipt's own monospace font, with none of the app's UI font or chrome bleeding in.
 *
 * jsPDF/html2canvas are loaded on demand (not at app startup) — together they're well over 500kB,
 * and staff pages are bundled eagerly for instant, offline-capable navigation; nobody should pay
 * that cost just to load the sales screen when they may never generate a receipt PDF.
 */
export async function buildReceiptPdf(node, filename) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true });

  const margin = 28; // px of blank paper around the receipt on every side
  const w = canvas.width / 2 + margin * 2;
  const h = canvas.height / 2 + margin * 2;
  const pdf = new jsPDF({ unit: 'px', format: [w, h] });
  pdf.setFillColor('#ffffff');
  pdf.rect(0, 0, w, h, 'F');
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, canvas.width / 2, canvas.height / 2);

  return { pdf, blob: pdf.output('blob'), filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf` };
}
