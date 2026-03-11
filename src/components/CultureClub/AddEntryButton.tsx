'use client';

export function AddEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add culture entry"
      className="grid h-9 w-9 place-items-center rounded-full border border-[#C084FC66] bg-[#C084FC22] text-base text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_0_14px_rgba(192,132,252,0.36)]"
    >
      📚
    </button>
  );
}
