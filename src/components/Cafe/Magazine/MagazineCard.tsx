'use client';

export type MagazineGridEntry = {
  id: string;
  label: string;
  title: string;
  date: string;
  a4_template_src?: string;
  elements?: Array<
    | {
        type: 'text';
        x: number;
        y: number;
        w: number;
        h: number;
        text: string;
        fontFamily: 'handwritten' | 'serif' | 'sans';
        fontSize: number;
        fontWeight: 'bold' | 'normal';
        fontStyle: 'italic' | 'normal';
      }
    | {
        type: 'image';
        x: number;
        y: number;
        w: number;
        h: number;
        src: string;
      }
  >;
  cover_preview_image: string;
};

export function MagazineCard({
  entry,
  onOpen,
  onDelete,
}: {
  entry: MagazineGridEntry;
  onOpen: (entry: MagazineGridEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group relative overflow-hidden rounded-xl border border-[#dbc6a6]/85 bg-[#fffdf8] text-left shadow-[0_6px_18px_rgba(56,38,24,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(56,38,24,0.18)]"
    >
      <button
        type="button"
        aria-label="Delete magazine entry"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(entry.id);
        }}
        className="absolute right-2 top-2 z-10 rounded-full border border-[#e2d3bf] bg-[rgba(255,248,236,0.92)] px-2 py-1 text-[11px] text-[#7a5f49] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        🗑
      </button>
      <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(246,235,214,0.5))] p-2">
        <div className="mx-auto aspect-[210/297] w-full max-w-[180px] overflow-hidden rounded-md border border-[#d8c4a1] bg-[#fff7e8]">
          <img src={entry.cover_preview_image} alt={entry.title} className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="border-t border-[#eadac3] px-3 py-2">
        <p className="truncate text-sm font-semibold text-[#4d3829]">{entry.title}</p>
        <p className="mt-1 text-[11px] text-[#7d6650]">{entry.label}</p>
      </div>
    </button>
  );
}
