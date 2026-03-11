'use client';

import { CultureCard, type CultureItem } from './CultureCard';

export function CultureGrid({
  items,
  onCardClick,
  onDelete,
  actionLabel,
  onAction,
}: {
  items: CultureItem[];
  onCardClick?: (item: CultureItem) => void;
  onDelete?: (item: CultureItem) => void;
  actionLabel?: (item: CultureItem) => string | undefined;
  onAction?: (item: CultureItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="grid min-h-[180px] place-items-center rounded-2xl border border-white/10 bg-black/20">
        <p className="text-sm text-[#B9B4D9]">No entries match these filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <CultureCard
          key={item.id}
          item={item}
          onClick={() => onCardClick?.(item)}
          onDelete={() => onDelete?.(item)}
          actionLabel={actionLabel?.(item)}
          onAction={() => onAction?.(item)}
        />
      ))}
    </div>
  );
}
