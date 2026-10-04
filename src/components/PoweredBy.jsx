import { cn } from '../utils/cn.js';

/** Small branding credit linking out to the agency's portfolio site. */
export function PoweredBy({ className }) {
  return (
    <div className={cn('flex justify-center', className)}>
      <a
        href="https://portfoliofrontend-wheat.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-[12.5px] text-ink-3 shadow-sm transition-colors hover:border-ink-3/30 hover:text-ink-2"
      >
        Powered by <span className="font-semibold text-ink-2">Horbahs Tech</span>
      </a>
    </div>
  );
}
