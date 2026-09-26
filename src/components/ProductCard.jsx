import { useEffect, useState } from 'react';
import { Package, ShoppingCart } from './icons.js';
import { StockBadge } from './ui/Badge.jsx';
import { Glyph } from './ui/Media.jsx';
import { useProductTheme } from '../hooks/useProductTheme.js';
import { money } from '../utils/format.js';
import { describeStock } from '../utils/units.js';
import { cn } from '../utils/cn.js';

/** Image tile: a soft pastel background sampled from the product's photo, photo centred and never cropped. */
function ProductImage({ product, theme, inCart }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product?.image]);
  const showImage = product?.image && !failed;
  return (
    <div className="relative aspect-[1/1.02] w-full overflow-hidden rounded-[10px]" style={{ background: theme.bg }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 68% 74%, ${theme.accent}26, transparent 62%)` }} />

      {inCart > 0 && <span className="absolute top-2.5 right-2.5 z-10 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-1.5 text-[12.5px] font-bold text-on-brand shadow-sm">{inCart}</span>}
      {product?.size && (
        <span className="absolute bottom-2.5 left-2.5 z-10 rounded-[9px] opacity-75 px-2 py-1 text-[11px] font-semibold text-white shadow-sm" style={{ background: theme.accent }}>
          {product.size}
        </span>
      )}

      {showImage ? (
        <img
          src={product.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-contain p-4 transition-transform duration-300 ease-out group-hover:scale-[1.05]"
        />
      ) : (
        <div className="grid size-full place-items-center [&>svg]:h-[46%] [&>svg]:w-auto">
          <Glyph shape={product?.shape} color={theme.accent} />
        </div>
      )}
    </div>
  );
}

function InventoryInfo({ product, out }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 bg-[#f1f1f1] p-3 rounded-[10px] text-[10px] text-ink-3">
      <Package size={13} className="flex-none" />
      <span className="truncate">{out ? 'Not available' : describeStock(product)}</span>
    </span>
  );
}

/** Purely visual affordance — the whole card is the tap target, so this doesn't need its own handler. */
function AddToCartButton({ theme, disabled }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 flex-none place-items-center rounded-[10px] text-white shadow-sm transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
      style={{ background: disabled ? 'var(--ink-3)' : theme.accent }}
    >
      <ShoppingCart size={16} strokeWidth={2.2} />
    </span>
  );
}

/** Tap-to-add product tile used on the staff home and New Sale screens. */
export function ProductCard({ product, inCart, onAdd }) {
  const out = product.status === 'out';
  const theme = useProductTheme(product);
  return (
    <button
      type="button"
      disabled={out}
      onClick={() => onAdd(product)}
      aria-label={`Add ${product.name}`}
      className={cn(
        'group flex flex-col gap-3 rounded-[15px] border border-line bg-surface p-3 text-left shadow-card transition-[border-color,box-shadow,transform] duration-200',
        'hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop active:scale-[0.98]',
        'disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-card'
      )}
    >
      <ProductImage product={product} theme={theme} inCart={inCart} />
      <div className="flex flex-col gap-1.5 px-0.5">
        <b className="line-clamp-2 text-[14px] leading-tight font-bold text-ink">{product.name}</b>
        <div className="flex items-center justify-between gap-1.5">
          <span className="tnum text-[15px] font-bold text-ink">{money(product.sellingPrice)}</span>
          <StockBadge status={product.status} />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <InventoryInfo product={product} out={out} />
          <AddToCartButton theme={theme} disabled={out} />
        </div>
      </div>
    </button>
  );
}
