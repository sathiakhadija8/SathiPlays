'use client';

export type MagazineEntry = {
  id: string;
  title: string;
  cover_image: string;
  content_html: string;
  created_at: number;
};

export function MagazineList({
  entries,
  onCreate,
  onEdit,
}: {
  entries: MagazineEntry[];
  onCreate: () => void;
  onEdit: (entry: MagazineEntry) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3
            className="cafe-heading text-[30px] leading-none text-[#4b3426]"
          >
            Magazine
          </h3>
          <p className="mt-1 text-xs text-[#7a624d]">Editorial notes, visual essays, and cozy writing pages.</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full border border-[#c8a377] bg-[#fff1dd] px-4 py-1.5 text-xs text-[#5f452f] shadow-[0_0_12px_rgba(175,132,81,0.22)] transition-all duration-200 hover:border-[#b28758] hover:shadow-[0_0_16px_rgba(175,132,81,0.34)]"
        >
          + New Entry
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#dec9ad]/80 bg-[#fffaf2]/70 p-3">
        {entries.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-[#d8c1a3] text-center text-sm text-[#7a624d]">
            <div>
              <p>No magazine entries yet.</p>
              <p className="mt-1 text-xs text-[#8b715b]">Create your first editorial note.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onEdit(entry)}
                className="group overflow-hidden rounded-xl border border-[#deccb0] bg-[#fffdf7] text-left shadow-[0_8px_18px_rgba(75,52,38,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(75,52,38,0.2)]"
              >
                <img
                  src={entry.cover_image || '/Images/background.png'}
                  alt={entry.title}
                  className="h-40 w-full object-cover"
                />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-[#4f382a]">{entry.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#7f6550]">
                    {(entry.content_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) ||
                      'No preview yet.'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
