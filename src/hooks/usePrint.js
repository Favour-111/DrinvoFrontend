import { useEffect, useState } from 'react';

/**
 * Print-to-PDF for any on-demand document: render your printable markup inside
 * #print-root (via a portal) only while `printing` is true, then call `print()`.
 * `filename` becomes the saved PDF's name via the page title, same trick the
 * receipt print uses. See index.css's `@media print` block for the CSS side.
 */
export function usePrint(filename) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return undefined;
    const title = document.title;
    document.title = filename;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printing, filename]);

  return { printing, print: () => setPrinting(true) };
}
