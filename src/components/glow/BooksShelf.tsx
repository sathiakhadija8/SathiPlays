import type { GlowBook } from '../../lib/glow-types';

export function BooksShelf({
  books,
  onOpen,
  onAddPolaroid,
}: {
  books: GlowBook[];
  onOpen: (bookId: number) => void;
  onAddPolaroid?: (bookId: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 max-[900px]:gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {books.map((book) => (
          <div
            key={book.id}
            className="animate-card-white-glow rounded-xl border border-white/30 bg-[rgba(255,255,255,0.08)] p-1.5 max-[900px]:p-1.5 text-left transition-all duration-200 hover:-translate-y-[1px] hover:border-white/50"
          >
            <img
              src={book.icon_path}
              alt={book.title}
              className="h-16 max-[900px]:h-16 w-full rounded-md border border-white/10 object-cover"
            />
            <p className="mt-1 truncate font-sans text-sm max-[900px]:text-xs text-[#F8F4FF]">{book.title}</p>
            <p className="font-sans text-xs max-[900px]:text-[10px] text-[#B9B4D9]">{book.image_count ?? 0} polaroids</p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => onOpen(book.id)}
                className="flex-1 rounded-full border border-[#C084FC66] bg-[#C084FC22] px-2 py-1 text-[11px] text-[#F8F4FF]"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => onAddPolaroid?.(book.id)}
                className="flex-1 rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-1 text-[11px] text-[#F8F4FF]"
              >
                + Polaroid
              </button>
            </div>
          </div>
        ))}
        {books.length === 0 && <p className="col-span-full font-sans text-sm text-[#B9B4D9]">No books yet. Create one from + Book.</p>}
      </div>
    </div>
  );
}
