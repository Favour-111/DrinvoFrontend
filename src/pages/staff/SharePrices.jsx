import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, MessageCircle, Search, X } from '../../components/icons.js';
import { Page, Chips } from '../../components/ui/Nav.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, FormError, Input, Textarea } from '../../components/ui/Form.jsx';
import { EmptyState, PageSkeleton, ErrorState } from '../../components/ui/Feedback.jsx';
import { ProductThumb } from '../../components/ui/Media.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { inventoryService, customerService } from '../../services/index.js';
import { money } from '../../utils/format.js';
import { bigUnit, conversionFor, priceFor, UNIT_LABEL } from '../../utils/units.js';
import { openWhatsApp, toWhatsAppDigits } from '../../utils/whatsapp.js';
import { cn } from '../../utils/cn.js';

const CATEGORY_EMOJI = { Beer: '🍺', 'Malt Drink': '🍺', 'Energy Drink': '⚡', Juice: '🧃', Water: '💧', 'Soft Drink': '🥤' };
const emojiFor = (category) => CATEGORY_EMOJI[category] || '🥤';

/** Both the bulk-unit price (whatever this product's biggest configured unit is — carton, crate
 * or pack) and the single-bottle price, clearly laid out per product. */
function buildMessage(products) {
  const blocks = products.map((p) => {
    const bulk = bigUnit(p);
    const lines = [`${emojiFor(p.category)} *${p.name}*`];
    if (bulk !== 'bottle') {
      const conv = conversionFor(p, bulk);
      lines.push(`${UNIT_LABEL[bulk]} (${conv} bottles): ${money(priceFor(p, bulk))}`);
    }
    lines.push(`Bottle: ${money(p.sellingPrice)}`);
    return lines.join('\n');
  });
  return `Hello 👋\nHere are our prices:\n\n${blocks.join('\n\n')}\n\nPlease let us know if you’d like to place an order. Thank you!`;
}

function PhonePicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q);
  const { data } = useApi(() => (debounced ? customerService.list({ q: debounced }) : Promise.resolve([])), [debounced]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={open ? q : value}
        onChange={(e) => {
          setOpen(true);
          setQ(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. 080XXXXXXXX or search a customer"
        aria-label="Customer’s WhatsApp number"
        type="tel"
        className="h-12 text-[15px]"
      />
      {open && data?.length > 0 && (
        <div className="max-h-36 overflow-auto rounded-[15px] border border-line-2 bg-surface-2">
          {data.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.phone);
                setQ(c.phone);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 border-b border-line-2 px-3 py-2 text-left text-[13.5px] last:border-0 hover:bg-surface-3"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="tnum text-[12.5px] text-ink-3">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A dedicated, roomy screen for building a WhatsApp price list — big enough to comfortably pick
 * several products and check the message before sending, rather than a cramped modal. Shows both
 * the bulk-unit price (carton/crate/pack) and the single-bottle price for each product. */
export default function SharePrices() {
  const { business } = useAuth();
  const isStaff = useLocation().pathname.startsWith('/staff');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { data, error: loadError, reload } = useApi(() => inventoryService.list(), []);

  const items = data?.items || [];
  const categories = useMemo(() => ['All', ...new Set(items.map((p) => p.category))], [items]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => (category === 'All' || p.category === category) && (!needle || p.name.toLowerCase().includes(needle)));
  }, [items, q, category]);
  const selectedProducts = useMemo(() => selected.map((id) => items.find((p) => p.variantId === id)).filter(Boolean), [selected, items]);

  useEffect(() => {
    if (!edited) setMessage(selectedProducts.length ? buildMessage(selectedProducts) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts.map((p) => p.variantId + p.sellingPrice).join(',')]);

  if (loadError && !data) return <ErrorState error={loadError} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={0} chart={false} />;

  const toggle = (variantId) => setSelected((s) => (s.includes(variantId) ? s.filter((id) => id !== variantId) : [...s, variantId]));

  const send = () => {
    if (toWhatsAppDigits(phone).length < 10) {
      setError('Enter the customer’s WhatsApp number first.');
      return;
    }
    if (!message.trim()) {
      setError('Select at least one product, or type a message.');
      return;
    }
    setError('');
    openWhatsApp(message, phone);
  };

  return (
    <Page className={isStaff ? 'pb-24' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-[22px] font-bold sm:text-[26px]">
            <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-ok-soft text-ok">
              <MessageCircle size={20} />
            </span>
            Share Prices on WhatsApp
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-3">Pick drinks, check the message, and send it from WhatsApp on this device — carton and bottle price included automatically.</p>
        </div>
        {business?.whatsappNumber && (
          <span className="rounded-full bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-ink-2">
            Sends from <b className="text-ink">{business.whatsappNumber}</b>
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="relative">
            <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks, e.g. coca" aria-label="Search products" className="input h-12 rounded-[14px] pl-10 text-[15px]" />
          </label>
          <Chips label="Category" options={categories.map((c) => [c, c])} value={category} onChange={setCategory} />
          <Card flush className="max-h-[560px] overflow-y-auto py-1">
            {list.length ? (
              list.map((p) => {
                const on = selected.includes(p.variantId);
                const bulk = bigUnit(p);
                return (
                  <button
                    key={p.variantId}
                    type="button"
                    onClick={() => toggle(p.variantId)}
                    className={cn('flex w-full items-center gap-3 border-b border-line-2 px-4 py-3 text-left last:border-0 hover:bg-surface-2', on && 'bg-ok-soft/40')}
                  >
                    <span className={cn('grid size-5 flex-none place-items-center rounded-[6px] border-2', on ? 'border-ok bg-ok text-white' : 'border-line')}>{on && <Check size={13} />}</span>
                    <ProductThumb product={p} size={38} />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] font-semibold">{p.name}</b>
                      <small className="text-[12px] text-ink-3">
                        {bulk !== 'bottle' && <>{UNIT_LABEL[bulk]} {money(priceFor(p, bulk))} · </>}Bottle {money(p.sellingPrice)}
                      </small>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState icon={Search} title="No drinks found" text="Try another search or category." />
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="label">Selected</span>
              <span className="text-[12.5px] font-semibold text-ink-2">{selected.length} selected</span>
            </div>
            {selectedProducts.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map((p) => (
                  <span key={p.variantId} className="flex items-center gap-1 rounded-full bg-surface-3 py-1 pr-1 pl-2.5 text-[12.5px] font-medium">
                    {p.name}
                    <button type="button" aria-label={`Remove ${p.name}`} onClick={() => toggle(p.variantId)} className="grid size-5 place-items-center rounded-full hover:bg-surface-solid/60">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="hint">Select drinks on the left — prices fill in automatically.</p>
            )}
          </Card>

          <Card className="flex flex-1 flex-col gap-3">
            <FormError message={error} />
            <Field label="Message">
              <Textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setEdited(true);
                }}
                placeholder="Select drinks to generate a message, or type your own."
                className="min-h-56 text-[14px]"
              />
            </Field>
            <Field label="Customer’s WhatsApp number">
              <PhonePicker value={phone} onChange={setPhone} />
            </Field>
            <Button variant="primary" size="lg" icon={MessageCircle} onClick={send} disabled={!message.trim()}>
              Send on WhatsApp
            </Button>
          </Card>
        </div>
      </div>
    </Page>
  );
}
