import { useEffect, useState } from 'react';
import { getImageTheme, themeFromColor } from '../utils/colorTheme.js';

/** Card theme for a product: the photo's sampled colour once it resolves, else its stored accent colour. */
export function useProductTheme(product) {
  const image = product?.image;
  const manual = themeFromColor(product?.color);
  const [theme, setTheme] = useState(manual);

  useEffect(() => {
    if (!image) {
      setTheme(manual);
      return undefined;
    }
    let alive = true;
    getImageTheme(image).then((t) => {
      if (alive) setTheme(t.ok ? t : manual);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, product?.color]);

  return theme;
}
