'use client';

import type { CultureType } from './CultureTabs';

export type CultureItem = {
  id: number;
  created_at?: string | null;
  title: string;
  type: CultureType;
  in_wishlist?: boolean;
  image_url: string;
  language: string;
  genres: string[];
  category_kind?: 'fiction' | 'deen' | null;
  rating?: number | null;
  review_text?: string | null;
  date_started?: string | null;
  date_completed?: string | null;
  status?: string | null;
  seasons_watched?: number | null;
  episodes_watched?: number | null;
  author?: string | null;
  total_pages?: number | null;
  pages_read?: number | null;
  mood?: string | null;
};

export function CultureCard({
  item,
  onClick,
  onDelete,
  actionLabel,
  onAction,
}: {
  item: CultureItem;
  onClick?: () => void;
  onDelete?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const isBook = item.type === 'book';
  const likedRatio = Math.max(0, Math.min(1, (item.rating ?? 0) / 10));
  const progressRatio = Math.max(
    0,
    Math.min(1, (item.pages_read ?? 0) / Math.max(1, item.total_pages ?? 0)),
  );
  const fillRatio = isBook ? progressRatio : likedRatio;
  const shownDate = item.date_completed || item.date_started || null;

  return (
    <article
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.42)] backdrop-blur-lg transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:shadow-[0_0_18px_rgba(255,62,165,0.22)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <img
          src={item.image_url}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="pointer-events-auto absolute inset-2 rounded-xl border border-white/15 bg-[rgba(18,16,40,0.72)] p-2 text-xs text-[#F8F4FF] backdrop-blur-md">
            {actionLabel && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.();
                }}
                className="absolute left-2 top-2 rounded-full border border-[#47d58c66] bg-[#47d58c22] px-2 py-0.5 text-[11px] text-[#d0ffe5]"
              >
                {actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
              className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[11px] text-[#ff9acb] hover:border-[#ff9acb66]"
            >
              🗑
            </button>
            <p className="text-[#B9B4D9]">{item.language}</p>
            <p className="mt-1 line-clamp-1">{item.genres.join(' • ')}</p>
            <p className="mt-1 text-[#B9B4D9]">{shownDate ? new Date(shownDate).toLocaleDateString('en-GB') : '—'}</p>
            {!isBook && <p className="mt-1">Rating: {item.rating ?? 0}/10</p>}
            {isBook && (
              <>
                <p className="mt-1">{item.author || 'Unknown author'}</p>
                <p>{item.status || 'Reading'}</p>
                <p>{item.mood || 'Calm'}</p>
                <p>{item.category_kind === 'deen' ? 'Deen' : 'Fiction'}</p>
                <p>{item.pages_read ?? 0} / {item.total_pages ?? 0}</p>
                <p className="text-[#B9B4D9]">Started: {item.date_started ? new Date(item.date_started).toLocaleDateString('en-GB') : '—'}</p>
                {item.status === 'Completed' && item.rating != null && <p>Rating: {item.rating}/10</p>}
              </>
            )}
            {item.type === 'series' && (
              <>
                <p className="mt-1">{item.status || 'Watching'}</p>
                <p>S{item.seasons_watched ?? 0} • E{item.episodes_watched ?? 0}</p>
              </>
            )}
            {!!item.review_text && <p className="mt-1 line-clamp-3 text-[#E7E3FA]">{item.review_text}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <p className="truncate font-serif text-base leading-tight text-[#F8F4FF]">{item.title}</p>
        <div className="h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/35">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF3EA5] to-[#C084FC] transition-all duration-300"
            style={{ width: `${Math.round(fillRatio * 100)}%` }}
          />
        </div>
        {isBook && item.status === 'Completed' && item.rating != null && (
          <p className="text-[11px] text-[#F8F4FF]">{'★'.repeat(Math.max(1, Math.round(item.rating / 2)))}<span className="text-[#B9B4D9]">{'★'.repeat(Math.max(0, 5 - Math.round(item.rating / 2)))}</span></p>
        )}
      </div>
    </article>
  );
}
