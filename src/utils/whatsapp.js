/** Nigerian-first normalizer: a local "080…" number becomes "234…"; anything that doesn't start
 * with a leading 0 is assumed to already carry its country code. */
export function toWhatsAppDigits(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  return digits;
}

/** Opens WhatsApp with `text` pre-filled, optionally pre-addressed to `phone`. Deliberately
 * api.whatsapp.com, not wa.me — wa.me does an extra redirect that's known to mangle 4-byte UTF-8
 * characters (emoji) into "�", and on desktop it's hit-or-miss whether it opens WhatsApp Web or
 * just the marketing page. api.whatsapp.com/send is the stable, documented endpoint both resolve
 * to, and it works the same everywhere — unlike `navigator.share`, which isn't supported on most
 * desktop browsers and silently has nothing to fall back to there. With no `phone`, WhatsApp
 * shows its own contact picker instead of failing.
 *
 * `target`, if given, is an already-open window to redirect instead of opening a new one — needed
 * whenever this runs after an `await` (e.g. generating a PDF first). Browsers only treat
 * `window.open()` as expected, not a blocked popup, when it happens synchronously inside the
 * click handler itself; calling it after any async delay gets silently blocked. Opening the window
 * immediately on click and redirecting it later sidesteps that entirely, since navigating an
 * already-open window is never treated as a popup. */
export function openWhatsApp(text, phone, target) {
  const digits = phone ? toWhatsAppDigits(phone) : '';
  const params = new URLSearchParams({ text });
  if (digits.length >= 10) params.set('phone', digits);
  const url = `https://api.whatsapp.com/send?${params.toString()}`;
  if (target && !target.closed) target.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
