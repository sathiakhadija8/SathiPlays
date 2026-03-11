'use client';

const BUILT_IN_TEMPLATES = [
  { id: 'a4_1', src: '/Images/A4Templates/a4_1.svg', label: 'Cream Grain' },
  { id: 'a4_2', src: '/Images/A4Templates/a4_2.svg', label: 'Lined Paper' },
  { id: 'a4_3', src: '/Images/A4Templates/a4_3.svg', label: 'Soft Bloom' },
];

export function A4TemplatePicker({
  open,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: string;
  onSelect: (src: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute left-0 top-12 z-20 w-[320px] rounded-xl border border-[#dbc7a9] bg-[#fff9ef] p-3 shadow-[0_10px_24px_rgba(58,40,26,0.18)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#5e4532]">A4 Templates</p>
        <button type="button" onClick={onClose} className="text-xs text-[#7e6650]">
          Close
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BUILT_IN_TEMPLATES.map((template) => {
          const active = selected === template.src;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template.src);
                onClose();
              }}
              className={`rounded-md border p-1 text-left transition-all ${
                active ? 'border-[#b58a5a] bg-[#f8e8d0]' : 'border-[#dfcfb5] bg-[#fffdf8] hover:border-[#c8aa84]'
              }`}
            >
              <div className="aspect-[210/297] overflow-hidden rounded-sm border border-[#e7d9c3]">
                <img src={template.src} alt={template.label} className="h-full w-full object-cover" />
              </div>
              <p className="mt-1 truncate text-[10px] text-[#6e5643]">{template.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
