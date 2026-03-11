'use client';

const LANGUAGES = ['Korean', 'Turkish', 'Bollywood', 'Hindi', 'English', 'British', 'Other'] as const;
const GENRES = ['Romance', 'Psychological', 'Thriller', 'Crime', 'Drama', 'Comedy', 'Fantasy', 'Sci-Fi', 'Historical', 'Documentary', 'Action'] as const;

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
        active
          ? 'border-[#FF3EA577] bg-[#FF3EA530] text-[#F8F4FF] shadow-[0_0_12px_rgba(255,62,165,0.24)]'
          : 'border-white/10 bg-black/20 text-[#B9B4D9] hover:text-[#F8F4FF]'
      }`}
    >
      {label}
    </button>
  );
}

export function CultureFilters({
  selectedLanguages,
  selectedGenres,
  onToggleLanguage,
  onToggleGenre,
  onClear,
}: {
  selectedLanguages: string[];
  selectedGenres: string[];
  onToggleLanguage: (language: string) => void;
  onToggleGenre: (genre: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#B9B4D9]">Filters</p>
        <button type="button" onClick={onClear} className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-[#F8F4FF]">
          Clear
        </button>
      </div>

      <div>
        <p className="mb-1 font-sans text-xs text-[#B9B4D9]">Language</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((language) => (
            <Chip
              key={language}
              label={language}
              active={selectedLanguages.includes(language)}
              onClick={() => onToggleLanguage(language)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 font-sans text-xs text-[#B9B4D9]">Genres</p>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((genre) => (
            <Chip key={genre} label={genre} active={selectedGenres.includes(genre)} onClick={() => onToggleGenre(genre)} />
          ))}
        </div>
      </div>
    </div>
  );
}
