export function BrandLockup({ brand, compact = false }) {
  if (!brand) return null;

  return (
    <div className="flex items-center gap-2.5">
      <div className="erp-brand-mark" aria-hidden="true">
        {brand.mark ?? "E"}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold">{brand.name}</div>
        {!compact && brand.section ? (
          <div className="text-[11px] text-secondary">{brand.section}</div>
        ) : null}
      </div>
    </div>
  );
}
