/** Generates a soft pastel card theme from a product photo's dominant colour, or from its stored accent colour when there is no photo. Results are cached per image URL for the life of the tab. */
import { api } from '../services/api.js';

const cache = new Map();

const NEUTRAL = { bg: 'var(--surface-2)', accent: 'var(--brand)', ok: false };

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { r: 5, g: 150, b: 105 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100 };
}

const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

// One hue drives both tones: a soft tint for the image tile, a readable mid tone for accents.
function themeFromHsl({ h, s }) {
  return { bg: hsl(h, Math.min(Math.max(s, 35), 60), 90), accent: hsl(h, Math.min(Math.max(s, 45), 70), 40), ok: true };
}

export function themeFromColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return themeFromHsl(rgbToHsl(r, g, b));
}

/** Loads `src` and averages its pixels into a theme. Resolves `null` (never rejects) on any
 * failure, including a tainted canvas, so the caller can decide what to try next. */
function loadAndSample(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        // Skip near-white/near-black/transparent pixels: usually studio-shot background, not the drink.
        for (let i = 0; i < data.length; i += 4) {
          const [pr, pg, pb, pa] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (pa < 128) continue;
          if ((pr > 235 && pg > 235 && pb > 235) || (pr < 18 && pg < 18 && pb < 18)) continue;
          r += pr;
          g += pg;
          b += pb;
          n++;
        }
        if (n < 8) {
          r = g = b = n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
        }
        if (!n) return resolve(null);
        resolve(themeFromHsl(rgbToHsl(r / n, g / n, b / n)));
      } catch {
        // Cross-origin image without CORS headers from its own host taints the canvas —
        // the caller retries this same photo through our own origin instead.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Most photos load and sample directly. If that fails — almost always a third-party host with
 * no CORS headers tainting the canvas — retry once through our own image proxy, which re-serves
 * the same bytes from an origin the browser already trusts for pixel reads. */
async function sampleImage(url) {
  const direct = await loadAndSample(url);
  if (direct) return direct;
  const proxied = await loadAndSample(`${api.defaults.baseURL}/image-proxy?src=${encodeURIComponent(url)}`);
  return proxied || NEUTRAL;
}

/** Resolves { bg, accent, ok } for a product image, memoised per URL for this tab. */
export function getImageTheme(url) {
  if (!url) return Promise.resolve(NEUTRAL);
  if (!cache.has(url)) cache.set(url, sampleImage(url));
  return cache.get(url);
}
