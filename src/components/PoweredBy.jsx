import { cn } from '../utils/cn.js';

/** Small branding credit linking out to the agency's portfolio site. */
export function PoweredBy({ className }) {
  return (
    <a
      href="https://portfoliofrontend-wheat.vercel.app/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn('block text-center text-[11px] font-medium text-ink-3 transition-colors hover:text-brand-ink', className)}
    >
      Powered by <span className="font-semibold">Horbahs Tech</span>
    </a>
  );
}
