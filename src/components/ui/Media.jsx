import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { initials } from '../../utils/format.js';

export function Glyph({ shape, color }) {
  if (shape === 'can')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="3.6" width="10" height="17" rx="2.2" fill={color} />
        <rect x="8.2" y="2.4" width="7.6" height="1.8" rx=".9" fill={color} opacity=".6" />
        <rect x="7" y="9.5" width="10" height="4.6" fill="#fff" opacity=".85" />
      </svg>
    );
  if (shape === 'box')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7.2 9 3h6l2 4.2V21H7z" fill={color} />
        <rect x="7" y="11" width="10" height="4.6" fill="#fff" opacity=".85" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 2h4v3.2l1.7 2.7c.2.4.3.8.3 1.2v11.4A1.5 1.5 0 0 1 14.5 22h-5A1.5 1.5 0 0 1 8 20.5V9.1c0-.4.1-.8.3-1.2L10 5.2z" fill={color} />
      <rect x="8" y="12" width="8" height="4.4" fill="#fff" opacity=".85" />
    </svg>
  );
}

/** Product image, or a coloured bottle / can / carton drawing when there is none. */
export function ProductThumb({ product, size = 40, className, fill }) {
  const color = product?.color || '#059669';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product?.image]);
  const showImage = product?.image && !failed;
  return (
    <span
      className={cn('inline-grid flex-none place-items-center overflow-hidden rounded-[11px] [&>svg]:h-[62%] [&>svg]:w-[62%]', className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface-2))`, ...(fill ? {} : { width: size, height: size }) }}
    >
      {showImage ? (
        <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <Glyph shape={product?.shape} color={color} />
      )}
    </span>
  );
}

export function Avatar({ user, size = 38 }) {
  return (
    <span
      className="inline-grid flex-none place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: user?.color || '#047857' }}
      aria-hidden="true"
    >
      {initials(user?.name)}
    </span>
  );
}

export function Logo({ className, light }) {
  return (
    <span className={cn('flex items-center gap-2.5 text-[21px] font-extrabold tracking-[-0.035em]', light ? 'text-white' : 'text-ink', className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9.5 2.5h5v3l2 3.2c.3.5.5 1.1.5 1.7V19a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19v-8.6c0-.6.2-1.2.5-1.7l2-3.2z" fill="#fff" />
          <path d="M7 13.5h10" stroke="#047857" strokeWidth="2" />
        </svg>
      </span>
      Drinvo
    </span>
  );
}

export function ProductCell({ product, name, sub, size = 40 }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProductThumb product={product} size={size} />
      <div className="min-w-0">
        <b className="block truncate font-semibold">{name}</b>
        {sub && <small className="text-[12px] text-ink-3">{sub}</small>}
      </div>
    </div>
  );
}
